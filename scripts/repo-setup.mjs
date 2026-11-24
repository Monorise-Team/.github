#!/usr/bin/env node
/**
 * Rozsyła wspólny proces pracy (ADR-0086) i zasady dla agentów AI do repozytoriów organizacji Monorise-Team.
 *
 *   node scripts/repo-setup.mjs forms <Repo> <katalog-.github> [--check]
 *       formularze zgłoszeń, config.yml i szablon pull requestu z templates/, z obszarami repozytorium;
 *       --check kończy się błędem, gdy zapisane pliki różnią się od wzorca
 *   node scripts/repo-setup.mjs agents <Repo> <katalog-repo> [--check]
 *       wspólny blok w AGENTS.md, odwołanie @AGENTS.md w CLAUDE.md, pliki z manifestu (GEMINI.md,
 *       .github/copilot-instructions.md, .github/workflows/sync-shared.yml) oraz usuwanie wycofanych plików
 *       z nagłówkiem monorise:generated; --check nic nie zapisuje i kończy się błędem przy różnicach
 *   node scripts/repo-setup.mjs sync <Repo> <katalog-repo> [--check]
 *       uruchamia forms (<katalog-repo>/.github) i agents (<katalog-repo>) razem
 *   node scripts/repo-setup.mjs about <Repo> [--dry-run | --check]
 *       ustawia opis, stronę i tematy repozytorium na GitHubie z labels/repos.json;
 *       --check porównuje stan na GitHubie i kończy się błędem przy rozbieżności
 *   node scripts/repo-setup.mjs labels <Repo> [--dry-run]
 *       etykiety z labels/common.json i obszary area: z labels/repos.json (tworzy brakujące, poprawia różniące się)
 *   node scripts/repo-setup.mjs protect <Repo> [--dry-run]
 *       ustawienia repozytorium (scalanie przez merge commit, usuwanie gałęzi po scaleniu, gałąź domyślna dev),
 *       uprawnienia GitHub Actions (token tylko do odczytu, zgoda na pull requesty od automatów),
 *       reguły ochrony gałęzi (tylko repozytoria publiczne) i prywatne zgłoszenia podatności.
 *       W repozytoriach produkcyjnych reguły nie wymagają zielonego CI: Release Please i powrót prod do dev
 *       scalają pull requesty tokenem GITHUB_TOKEN, a takie pull requesty nie uruchamiają CI. Zielone CI przed
 *       scaleniem pull requestu zadania jest umową zespołu, dopóki nie mamy własnej aplikacji GitHub.
 *   node scripts/repo-setup.mjs dispatch [<Repo>…]
 *       uruchamia workflow sync-shared.yml w podanych repozytoriach (albo we wszystkich z labels/repos.json
 *       poza .github); pomija repozytoria, które nie mają jeszcze tego workflow
 *   node scripts/repo-setup.mjs audit [--markdown <plik>]
 *       sprawdza repozytoria organizacji na GitHubie przeciwko labels/repos.json (brakujące wpisy, nieistniejące
 *       repozytoria, rozbieżności About, brak .github/workflows/sync-shared.yml); kończy się błędem przy uwagach
 *
 * Polecenia odwołujące się do GitHuba wymagają zalogowanego `gh` (dla labels/protect/about z uprawnieniem admina).
 */
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORG = "Monorise-Team";
const PROJECT = `${ORG}/3`;

const SHARED_TEMPLATE = "templates/agents/shared.md";
const SHARED_BEGIN =
  "<!-- BEGIN:monorise-shared (wstawione z Monorise-Team/.github, templates/agents/shared.md; zmieniaj wzorzec, nie ten blok) -->";
const SHARED_END = "<!-- END:monorise-shared -->";
const SHARED_BEGIN_RE = /<!-- BEGIN:monorise-shared(?:\s[^>]*)? -->/;
const SHARED_BLOCK_RE = /<!-- BEGIN:monorise-shared(?:\s[^>]*)? -->[\s\S]*?<!-- END:monorise-shared -->/;
const GENERATED_MARKER = "monorise:generated";
const AGENTS_MAX_CHARS = 12000;
const CLAUDE_IMPORT_LINE =
  "Zasady pracy w tym repozytorium są wspólne dla wszystkich agentów i opisane w @AGENTS.md.";

// Jedna lista plików zarządzanych w całości przez `agents` / `sync`.
// Usunięcie wpisu stąd powoduje usunięcie pliku z nagłówkiem `monorise:generated` przy kolejnej synchronizacji.
const AGENT_MANIFEST = [
  { template: "templates/agents/GEMINI.md", target: "GEMINI.md" },
  { template: "templates/agents/copilot-instructions.md", target: ".github/copilot-instructions.md" },
  {
    template: "templates/agents/sync-shared.yml",
    target: ".github/workflows/sync-shared.yml",
    skipRepos: [".github"],
  },
];

const repos = JSON.parse(readFileSync(join(ROOT, "labels/repos.json"), "utf8"));
const common = JSON.parse(readFileSync(join(ROOT, "labels/common.json"), "utf8"));

function settingsOf(repo) {
  const settings = !repo.startsWith("$") ? repos[repo] : undefined;
  if (!settings) throw new Error(`Brak repozytorium ${repo} w labels/repos.json`);
  return settings;
}

function gh(args, { input, allowFail = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(" ")}\n${error.stderr || error.message}`);
  }
}

const ghJson = (args, options) => {
  const out = gh(args, options);
  return out === null ? null : JSON.parse(out || "null");
};

const normalizeTopics = (topics) => [...new Set((topics ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))].sort();

const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ── Formularze ──────────────────────────────────────────────────────────────

const indent = (lines, spaces) => lines.map((line) => (line ? " ".repeat(spaces) + line : line));

function areaBlock(areas, extra) {
  if (!areas.length) return "";
  return [
    "  - type: dropdown",
    "    id: area",
    "    attributes:",
    "      label: Obszar",
    "      multiple: true",
    "      options:",
    ...indent([...areas.map((area) => `- ${area.name}`), `- ${extra}`], 8),
    "    validations:",
    "      required: true",
    "",
  ].join("\n");
}

function priorityBlock(withCritical) {
  const options = [...(withCritical ? ["P0-critical"] : []), "P1-high", "P2-medium", "P3-low"];
  return [
    "  - type: dropdown",
    "    id: priority",
    "    attributes:",
    "      label: Priorytet",
    ...(withCritical
      ? ["      description: P0 to produkcja leży, P1 blokuje milestone, P2 poczeka, P3 to kosmetyka."]
      : []),
    "      options:",
    ...indent(
      options.map((option) => `- ${option}`),
      8,
    ),
    "    validations:",
    "      required: true",
    "",
  ].join("\n");
}

const EFFORT = [
  "  - type: dropdown",
  "    id: effort",
  "    attributes:",
  "      label: Nakład pracy",
  "      description: Mały to ten sam dzień, średni około 2 dni, duży około tygodnia. Bez odpowiedzi średni.",
  "      options:",
  "        - Mały",
  "        - Średni",
  "        - Duży",
  "    validations:",
  "      required: false",
  "",
].join("\n");

const RELATIONS = [
  "  - type: textarea",
  "    id: relations",
  "    attributes:",
  "      label: Zależności",
  '      description: "Opcjonalne, jedna na linię. `Czeka na: #123` to zgłoszenie, które musi być gotowe wcześniej, `Część: #45` to większe zadanie, którego to jest etapem."',
  "      placeholder: |",
  "        Czeka na: #12",
  "        Część: #4",
  "    validations:",
  "      required: false",
].join("\n");

const securityLink = (repo) =>
  repo === ".github"
    ? `https://github.com/${ORG}/.github/blob/main/SECURITY.md`
    : `https://github.com/${ORG}/${repo}/security/advisories/new`;

function renderForm(template, repo) {
  const { areas } = settingsOf(repo);
  const text = template
    .replaceAll("__PROJECT__", PROJECT)
    .replaceAll("__AREA_WHOLE__", areaBlock(areas, "całe repozytorium"))
    .replaceAll("__AREA__", areaBlock(areas, "nie wiem"))
    .replaceAll("__PRIORITY_ALL__", priorityBlock(true))
    .replaceAll("__PRIORITY__", priorityBlock(false))
    .replaceAll("__EFFORT__", EFFORT)
    .replaceAll("__RELATIONS__", RELATIONS)
    .replaceAll("__SECURITY__", `[prywatne zgłoszenie podatności](${securityLink(repo)})`);
  return `# Wygenerowane z Monorise-Team/.github (templates/) przez scripts/repo-setup.mjs; zmieniaj wzorzec, nie ten plik.\n${text
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

function renderConfig(repo) {
  return [
    "# Wygenerowane z Monorise-Team/.github przez scripts/repo-setup.mjs; zmieniaj wzorzec, nie ten plik.",
    "blank_issues_enabled: false",
    "contact_links:",
    "  - name: 🔒 Zgłoś podatność prywatnie",
    `    url: ${securityLink(repo)}`,
    "    about: Nie zakładaj publicznego zgłoszenia dla podatności, którą da się wykorzystać.",
    "  - name: 💬 Kontakt z Monorise",
    "    url: mailto:hello@monorise.studio",
    "    about: Pytania o współpracę i wycenę projektu.",
    "",
  ].join("\n");
}

function forms(repo, outDir, { check }) {
  const files = new Map();
  const templates = join(ROOT, "templates/ISSUE_TEMPLATE");
  for (const name of readdirSync(templates).filter((file) => /^\d-.*\.yml$/.test(file)).sort()) {
    files.set(join("ISSUE_TEMPLATE", name), renderForm(readFileSync(join(templates, name), "utf8"), repo));
  }
  files.set(join("ISSUE_TEMPLATE", "config.yml"), renderConfig(repo));
  files.set("pull_request_template.md", readFileSync(join(ROOT, "templates/pull_request_template.md"), "utf8"));

  let differs = 0;
  for (const [path, content] of files) {
    const target = join(outDir, path);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === content) continue;
    differs += 1;
    if (check) {
      console.log(`różni się od wzorca: ${target}`);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      console.log(`zapisano: ${target}`);
    }
  }
  if (!differs) console.log(`${repo}: formularze zgodne ze wzorcem`);
  return { differs };
}

// ── Pliki agentów AI ────────────────────────────────────────────────────────

function insertAfterFirstHeading(text, snippet, fallbackHeading) {
  const heading = text.match(/^# [^\r\n]*/m);
  if (heading) {
    const headingEnd = heading.index + heading[0].length;
    const prefix = text.slice(0, headingEnd);
    const rest = text.slice(headingEnd).replace(/^(?:\r?\n)+/, "");
    return rest ? `${prefix}\n\n${snippet}\n\n${rest}` : `${prefix}\n\n${snippet}\n`;
  }
  const rest = text.replace(/^(?:\r?\n)+/, "");
  return rest ? `${fallbackHeading}\n\n${snippet}\n\n${rest}` : `${fallbackHeading}\n\n${snippet}\n`;
}

function listTargetFiles(dir) {
  if (existsSync(join(dir, ".git"))) {
    try {
      const out = execFileSync("git", ["-C", dir, "ls-files", "-z"], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return out.split("\0").filter(Boolean);
    } catch {
      // Gdy `git` nie ma dostępu do nadrzędnego katalogu .git (np. w sandboxie), przechodzimy drzewo ręcznie.
    }
  }
  const out = [];
  const skip = new Set(["node_modules", ".git", ".monorise-shared"]);
  const walk = (rel) => {
    const full = rel ? join(dir, rel) : dir;
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) out.push(next);
    }
  };
  if (existsSync(dir)) walk("");
  return out;
}

function hasGeneratedMarker(filePath) {
  let fd;
  try {
    if (!statSync(filePath).isFile()) return false;
    fd = openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytes = readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, bytes);
    if (head.includes(0)) return false;
    return head.toString("utf8").split(/\r?\n/, 5).some((line) => line.includes(GENERATED_MARKER));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function agents(repo, repoDir, { check }) {
  settingsOf(repo);
  const sharedText = readFileSync(join(ROOT, SHARED_TEMPLATE), "utf8").trim();
  const sharedBlock = `${SHARED_BEGIN}\n\n${sharedText}\n\n${SHARED_END}`;

  let differs = 0;
  let errors = 0;
  const writes = [];
  const deletes = [];
  const checkLogs = [];

  // 1. AGENTS.md
  const agentsPath = join(repoDir, "AGENTS.md");
  const currentAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  let nextAgents = null;

  if (currentAgents === null) {
    nextAgents = [
      "# AGENTS.md",
      "",
      sharedBlock,
      "",
      "## Czym jest to repozytorium",
      "",
      "Uzupełnij opis tego repozytorium: czym jest, jakie ma polecenia i jakie obowiązują w nim zasady kodu.",
      "",
    ].join("\n");
    if (!check) {
      console.warn(
        `UWAGA: ${repo}: brakowało AGENTS.md — utworzono szablon, uzupełnij sekcję „Czym jest to repozytorium”.`,
      );
    }
  } else {
    const hasBegin = SHARED_BEGIN_RE.test(currentAgents);
    const hasEnd = currentAgents.includes(SHARED_END);
    if (hasBegin !== hasEnd) {
      console.error(`BŁĄD: ${agentsPath} ma niekompletne znaczniki monorise-shared.`);
      errors += 1;
    } else if (hasBegin && hasEnd) {
      nextAgents = currentAgents.replace(SHARED_BLOCK_RE, () => sharedBlock);
    } else {
      nextAgents = insertAfterFirstHeading(currentAgents, sharedBlock, "# AGENTS.md");
    }
  }

  if (nextAgents !== null) {
    if (nextAgents.length > AGENTS_MAX_CHARS) {
      console.error(
        `BŁĄD: ${agentsPath} ma ${nextAgents.length} znaków (limit ${AGENTS_MAX_CHARS} dla Antigravity). Skróć część specyficzną dla repozytorium.`,
      );
      errors += 1;
    } else if (currentAgents !== nextAgents) {
      differs += 1;
      const verb = currentAgents === null ? "utworzono" : "zapisano";
      checkLogs.push(`${currentAgents === null ? "do utworzenia" : "do zmiany"}: ${agentsPath}`);
      writes.push({ path: agentsPath, content: nextAgents, verb });
    }
  }

  // 2. CLAUDE.md
  const claudePath = join(repoDir, "CLAUDE.md");
  const currentClaude = existsSync(claudePath) ? readFileSync(claudePath, "utf8") : null;
  if (currentClaude === null) {
    const nextClaude = `# CLAUDE.md\n\n${CLAUDE_IMPORT_LINE}\n`;
    differs += 1;
    checkLogs.push(`do utworzenia: ${claudePath}`);
    writes.push({ path: claudePath, content: nextClaude, verb: "utworzono" });
  } else if (!currentClaude.includes("@AGENTS.md")) {
    const nextClaude = insertAfterFirstHeading(currentClaude, CLAUDE_IMPORT_LINE, "# CLAUDE.md");
    differs += 1;
    checkLogs.push(`do zmiany (brak @AGENTS.md): ${claudePath}`);
    writes.push({ path: claudePath, content: nextClaude, verb: "zapisano" });
  }

  // 3. Pliki z manifestu
  const activeManifest = AGENT_MANIFEST.filter((entry) => !entry.skipRepos?.includes(repo));
  const activeTargets = new Set(activeManifest.map((entry) => entry.target));

  for (const { template, target } of activeManifest) {
    const content = readFileSync(join(ROOT, template), "utf8");
    const fullTarget = join(repoDir, target);
    const current = existsSync(fullTarget) ? readFileSync(fullTarget, "utf8") : null;
    if (current === content) continue;
    differs += 1;
    const verb = current === null ? "utworzono" : "zapisano";
    checkLogs.push(`${current === null ? "do utworzenia" : "do zmiany"}: ${fullTarget}`);
    writes.push({ path: fullTarget, content, verb });
  }

  // 4. Usuwanie wycofanych plików oznaczonych monorise:generated
  for (const rel of listTargetFiles(repoDir).sort()) {
    const norm = rel.split("\\").join("/");
    if (activeTargets.has(norm)) continue;
    if (repo === ".github" && norm.startsWith("templates/")) continue;
    const full = join(repoDir, norm);
    if (!existsSync(full) || !hasGeneratedMarker(full)) continue;
    differs += 1;
    checkLogs.push(`do usunięcia: ${full}`);
    deletes.push(full);
  }

  if (check) {
    for (const line of checkLogs) console.log(line);
  } else if (!errors) {
    for (const { path, content, verb } of writes) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      console.log(`${verb}: ${path}`);
    }
    for (const path of deletes) {
      unlinkSync(path);
      console.log(`usunięto: ${path}`);
    }
  }

  if (!differs && !errors) console.log(`${repo}: pliki agentów zgodne ze wzorcem`);
  return { differs, errors };
}

function sync(repo, repoDir, { check }) {
  const formsResult = forms(repo, join(repoDir, ".github"), { check });
  const agentsResult = agents(repo, repoDir, { check });
  return {
    differs: formsResult.differs + agentsResult.differs,
    errors: agentsResult.errors,
  };
}

// ── About (opis, strona, tematy) ────────────────────────────────────────────

function about(repo, { dryRun, check }) {
  const settings = settingsOf(repo);
  const hasDesc = settings.description !== undefined;
  const hasHomepage = settings.homepage !== undefined;
  const hasTopics = Array.isArray(settings.topics);

  if (!hasDesc && !hasHomepage && !hasTopics) {
    console.log(`${repo}: brak pól description/homepage/topics w labels/repos.json`);
    return check ? 1 : 0;
  }

  const info = ghJson(["api", `repos/${ORG}/${repo}`]);
  const currentDesc = info.description ?? "";
  const currentHomepage = info.homepage ?? "";
  const rawTopics = Array.isArray(info.topics)
    ? info.topics
    : (ghJson(["api", `repos/${ORG}/${repo}/topics`])?.names ?? []);
  const currentTopics = normalizeTopics(rawTopics);
  const wantTopics = hasTopics ? normalizeTopics(settings.topics) : null;

  const diffs = [];
  if (hasDesc && currentDesc !== settings.description) {
    diffs.push(`opis: „${currentDesc}” -> „${settings.description}”`);
  }
  if (hasHomepage && currentHomepage !== settings.homepage) {
    diffs.push(`strona: „${currentHomepage}” -> „${settings.homepage}”`);
  }
  if (hasTopics && !arraysEqual(currentTopics, wantTopics)) {
    diffs.push(`tematy: [${currentTopics.join(", ")}] -> [${wantTopics.join(", ")}]`);
  }

  if (!diffs.length) {
    console.log(`${repo}: ustawienia „About” zgodne z labels/repos.json`);
    return 0;
  }

  for (const diff of diffs) console.log(`${repo}: ${diff}`);
  if (check) return 1;
  if (dryRun) return 0;

  if ((hasDesc && currentDesc !== settings.description) || (hasHomepage && currentHomepage !== settings.homepage)) {
    const editArgs = ["repo", "edit", `${ORG}/${repo}`];
    if (hasDesc) editArgs.push("--description", settings.description);
    if (hasHomepage) editArgs.push("--homepage", settings.homepage);
    gh(editArgs);
  }
  if (hasTopics && !arraysEqual(currentTopics, wantTopics)) {
    gh(["api", "-X", "PUT", `repos/${ORG}/${repo}/topics`, "--input", "-"], {
      input: JSON.stringify({ names: wantTopics }),
    });
  }
  console.log(`${repo}: zaktualizowano ustawienia „About”`);
  return 0;
}

// ── Etykiety ────────────────────────────────────────────────────────────────

function labels(repo, { dryRun }) {
  const { areas } = settingsOf(repo);
  const wanted = [
    ...common,
    ...areas.map((area) => ({ name: `area: ${area.name}`, color: "8250DF", description: area.description })),
  ];
  const existing = new Map(
    ghJson(["api", `repos/${ORG}/${repo}/labels?per_page=100`, "--paginate"]).map((label) => [label.name, label]),
  );
  for (const label of wanted) {
    const current = existing.get(label.name);
    if (current && current.color.toLowerCase() === label.color.toLowerCase() && (current.description ?? "") === label.description)
      continue;
    const action = current ? "poprawiam" : "tworzę";
    console.log(`${repo}: ${action} ${label.name}`);
    if (dryRun) continue;
    if (current) {
      gh([
        "api",
        "-X",
        "PATCH",
        `repos/${ORG}/${repo}/labels/${encodeURIComponent(label.name)}`,
        "-f",
        `color=${label.color}`,
        "-f",
        `description=${label.description}`,
      ]);
    } else {
      gh([
        "api",
        "-X",
        "POST",
        `repos/${ORG}/${repo}/labels`,
        "-f",
        `name=${label.name}`,
        "-f",
        `color=${label.color}`,
        "-f",
        `description=${label.description}`,
      ]);
    }
  }
  console.log(`${repo}: etykiety gotowe (${wanted.length})`);
}

// ── Ustawienia i reguły ─────────────────────────────────────────────────────

function rulesets(repo) {
  const { kind, checks } = settingsOf(repo);
  const branches = kind === "production" ? ["dev", "prod"] : ["main"];
  return branches.map((branch) => ({
    name: `Chroń ${branch}`,
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: [`refs/heads/${branch}`], exclude: [] } },
    bypass_actors: [{ actor_id: null, actor_type: "OrganizationAdmin", bypass_mode: "pull_request" }],
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: true,
          allowed_merge_methods: ["merge"],
        },
      },
      ...(kind === "main" && checks.length
        ? [
            {
              type: "required_status_checks",
              parameters: {
                strict_required_status_checks_policy: false,
                required_status_checks: checks.map((context) => ({ context })),
              },
            },
          ]
        : []),
    ],
  }));
}

function protect(repo, { dryRun }) {
  const { kind, public: isPublic } = settingsOf(repo);
  const info = ghJson(["api", `repos/${ORG}/${repo}`]);
  const branches = new Set(ghJson(["api", `repos/${ORG}/${repo}/branches?per_page=100`, "--paginate"]).map((b) => b.name));

  const settings = ["allow_merge_commit=true", "allow_squash_merge=false", "allow_rebase_merge=false", "delete_branch_on_merge=true"];
  if (kind === "production" && branches.has("dev") && info.default_branch !== "dev") settings.push("default_branch=dev");
  console.log(`${repo}: ustawienia ${settings.join(", ")}`);
  if (!dryRun) gh(["api", "-X", "PATCH", `repos/${ORG}/${repo}`, ...settings.flatMap((s) => ["-F", s])]);

  // Release Please i powrót prod do dev otwierają i scalają pull requesty tokenem GITHUB_TOKEN. Organizacja na to
  // pozwala, ale repozytorium może mieć własne, węższe ustawienie (tak było w MonoriseWebsite), więc je wyrównujemy.
  const actions = { default_workflow_permissions: "read", can_approve_pull_request_reviews: true };
  const workflow = ghJson(["api", `repos/${ORG}/${repo}/actions/permissions/workflow`]);
  const actionsOk = Object.entries(actions).every(([key, value]) => workflow?.[key] === value);
  console.log(`${repo}: Actions: token domyślnie tylko do odczytu, automaty mogą tworzyć pull requesty${actionsOk ? " (bez zmian)" : ""}`);
  if (!dryRun && !actionsOk) {
    gh(["api", "-X", "PUT", `repos/${ORG}/${repo}/actions/permissions/workflow`, "--input", "-"], { input: JSON.stringify(actions) });
  }

  if (!isPublic || info.private) {
    console.log(`${repo}: repozytorium prywatne na planie Free, reguły ochrony gałęzi pomijam (ADR-0016)`);
    return;
  }
  if (!dryRun) gh(["api", "-X", "PUT", `repos/${ORG}/${repo}/private-vulnerability-reporting`], { allowFail: true });

  const existing = ghJson(["api", `repos/${ORG}/${repo}/rulesets`]) ?? [];
  for (const ruleset of rulesets(repo)) {
    const branch = ruleset.conditions.ref_name.include[0].replace("refs/heads/", "");
    if (!branches.has(branch)) {
      console.log(`${repo}: brak gałęzi ${branch}, pomijam „${ruleset.name}”`);
      continue;
    }
    const current = existing.find((r) => r.name === ruleset.name);
    console.log(`${repo}: ${current ? "aktualizuję" : "tworzę"} regułę „${ruleset.name}”`);
    if (dryRun) continue;
    const input = JSON.stringify(ruleset);
    if (current) gh(["api", "-X", "PUT", `repos/${ORG}/${repo}/rulesets/${current.id}`, "--input", "-"], { input });
    else gh(["api", "-X", "POST", `repos/${ORG}/${repo}/rulesets`, "--input", "-"], { input });
  }
}

// ── Dispatch i audyt ────────────────────────────────────────────────────────

function dispatch(targets) {
  const list = targets.length
    ? targets
    : Object.keys(repos).filter((name) => !name.startsWith("$") && name !== ".github" && !repos[name].planned);
  let triggered = 0;
  let missing = 0;
  let failed = 0;

  for (const repo of list) {
    if (repo === ".github") {
      console.log(`.github: pomijam — to repozytorium jest źródłem wzorców`);
      continue;
    }
    try {
      gh(["workflow", "run", "sync-shared.yml", "-R", `${ORG}/${repo}`]);
      console.log(`${repo}: uruchomiono sync-shared.yml`);
      triggered += 1;
    } catch (error) {
      const msg = error.message || "";
      if (/404|not found|could not find any workflows/i.test(msg)) {
        console.log(`${repo}: brak workflow sync-shared.yml (albo repozytorium nie istnieje) — pomijam`);
        missing += 1;
      } else {
        console.error(`${repo}: błąd uruchamiania sync-shared.yml: ${msg.trim()}`);
        failed += 1;
      }
    }
  }
  console.log(`Podsumowanie dispatch: uruchomiono ${triggered}, brak workflow ${missing}, błędów ${failed}.`);
  return failed > 0 ? 1 : 0;
}

function audit({ markdownPath }) {
  const listed = ghJson([
    "repo",
    "list",
    ORG,
    "--json",
    "name,description,homepageUrl,repositoryTopics,isPrivate,isArchived",
    "--limit",
    "200",
  ]);
  const active = listed.filter((r) => !r.isArchived).sort((a, b) => a.name.localeCompare(b.name));
  const activeByName = new Map(active.map((r) => [r.name, r]));
  const archivedNames = new Set(listed.filter((r) => r.isArchived).map((r) => r.name));
  const configured = Object.entries(repos).filter(([name]) => !name.startsWith("$"));
  const configuredNames = new Set(configured.map(([name]) => name));

  const problems = [];

  for (const repo of active) {
    if (!configuredNames.has(repo.name)) {
      problems.push(`- **${repo.name}**: brak wpisu w \`labels/repos.json\`.`);
    }
  }

  for (const [name, cfg] of configured) {
    if (activeByName.has(name) || archivedNames.has(name)) continue;
    if (cfg.public === false || cfg.planned) continue;
    problems.push(
      `- **${name}**: wpis istnieje w \`labels/repos.json\`, ale repozytorium nie istnieje w organizacji \`${ORG}\` (albo nie jest widoczne dla tokenu).`,
    );
  }

  for (const repo of active) {
    if (!configuredNames.has(repo.name)) continue;
    const cfg = repos[repo.name];
    const hasDesc = cfg.description !== undefined;
    const hasHomepage = cfg.homepage !== undefined;
    const hasTopics = Array.isArray(cfg.topics);

    if (!hasDesc && !hasHomepage && !hasTopics) {
      problems.push(`- **${repo.name}**: brak pól \`description\`, \`homepage\` i \`topics\` w \`labels/repos.json\`.`);
    } else {
      const diffs = [];
      if (hasDesc && (repo.description ?? "") !== cfg.description) {
        diffs.push(`opis („${repo.description ?? ""}” != „${cfg.description}”)`);
      }
      if (hasHomepage && (repo.homepageUrl ?? "") !== cfg.homepage) {
        diffs.push(`strona („${repo.homepageUrl ?? ""}” != „${cfg.homepage}”)`);
      }
      if (hasTopics) {
        const currentTopics = normalizeTopics(
          (repo.repositoryTopics ?? []).map((t) => (typeof t === "string" ? t : (t?.name ?? ""))),
        );
        const wantTopics = normalizeTopics(cfg.topics);
        if (!arraysEqual(currentTopics, wantTopics)) {
          diffs.push(`tematy ([${currentTopics.join(", ")}] != [${wantTopics.join(", ")}])`);
        }
      }
      if (diffs.length) {
        problems.push(
          `- **${repo.name}**: rozbieżność „About” (${diffs.join("; ")}) — uruchom \`node scripts/repo-setup.mjs about ${repo.name}\`.`,
        );
      }
    }

    if (repo.name !== ".github") {
      const hasSync = gh(["api", `repos/${ORG}/${repo.name}/contents/.github/workflows/sync-shared.yml`], {
        allowFail: true,
      });
      if (hasSync === null) {
        problems.push(
          `- **${repo.name}**: brak pliku \`.github/workflows/sync-shared.yml\` na gałęzi domyślnej (codzienna synchronizacja nie działa).`,
        );
      }
    }
  }

  const lines = problems.length
    ? [
        `Wykryto ${problems.length} niezgodności w repozytoriach organizacji \`${ORG}\`:`,
        "",
        ...problems,
        "",
        "---",
        "",
        "Uwaga: audyt w GitHub Actions używa tokenu `GITHUB_TOKEN`, dlatego repozytoria prywatne (oznaczone `public: false` w `labels/repos.json`) mogą nie być widoczne i są wtedy pomijane.",
        "",
      ]
    : [
        `Wszystkie widoczne repozytoria organizacji \`${ORG}\` są zgodne z \`labels/repos.json\` i mają \`.github/workflows/sync-shared.yml\`.`,
        "",
      ];
  const output = lines.join("\n");

  if (markdownPath) {
    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, output);
  }
  process.stdout.write(output);
  return problems.length > 0 ? 1 : 0;
}

// ── Wywołanie ───────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const flags = new Set();
const options = new Map();
const positional = [];
for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg === "--markdown") {
    const next = rawArgs[i + 1];
    if (!next || next.startsWith("--")) {
      console.error("Brak ścieżki po --markdown");
      process.exit(2);
    }
    options.set("markdown", next);
    i += 1;
  } else if (arg.startsWith("--")) {
    flags.add(arg);
  } else {
    positional.push(arg);
  }
}

const [command, repo, dir] = positional;
const usage = [
  "Użycie: repo-setup.mjs",
  "  forms <Repo> <katalog-.github> [--check]",
  "  agents <Repo> <katalog-repo> [--check]",
  "  sync <Repo> <katalog-repo> [--check]",
  "  about <Repo> [--dry-run | --check]",
  "  labels <Repo> [--dry-run]",
  "  protect <Repo> [--dry-run]",
  "  dispatch [<Repo>…]",
  "  audit [--markdown <plik>]",
].join("\n");

if (command === "forms" && repo && dir) {
  const { differs } = forms(repo, dir, { check: flags.has("--check") });
  if (flags.has("--check") && differs) process.exit(1);
} else if (command === "agents" && repo && dir) {
  const { differs, errors } = agents(repo, dir, { check: flags.has("--check") });
  if (errors || (flags.has("--check") && differs)) process.exit(1);
} else if (command === "sync" && repo && dir) {
  const { differs, errors } = sync(repo, dir, { check: flags.has("--check") });
  if (errors || (flags.has("--check") && differs)) process.exit(1);
} else if (command === "about" && repo) {
  process.exit(about(repo, { dryRun: flags.has("--dry-run"), check: flags.has("--check") }));
} else if (command === "labels" && repo) {
  labels(repo, { dryRun: flags.has("--dry-run") });
} else if (command === "protect" && repo) {
  protect(repo, { dryRun: flags.has("--dry-run") });
} else if (command === "dispatch") {
  process.exit(dispatch(positional.slice(1)));
} else if (command === "audit") {
  process.exit(audit({ markdownPath: options.get("markdown") }));
} else {
  console.error(usage);
  process.exit(2);
}
