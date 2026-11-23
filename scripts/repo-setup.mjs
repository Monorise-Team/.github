#!/usr/bin/env node
/**
 * Rozsyła wspólny proces pracy (ADR-0086) do repozytoriów organizacji Monorise-Team.
 *
 *   node scripts/repo-setup.mjs forms <Repo> <katalog-.github> [--check]
 *       formularze zgłoszeń, config.yml i szablon pull requestu z templates/, z obszarami repozytorium;
 *       --check kończy się błędem, gdy zapisane pliki różnią się od wzorca
 *   node scripts/repo-setup.mjs labels <Repo> [--dry-run]
 *       etykiety z labels/common.json i obszary area: z labels/repos.json (tworzy brakujące, poprawia różniące się)
 *   node scripts/repo-setup.mjs protect <Repo> [--dry-run]
 *       ustawienia repozytorium (scalanie przez merge commit, usuwanie gałęzi po scaleniu, gałąź domyślna dev),
 *       uprawnienia GitHub Actions (token tylko do odczytu, zgoda na pull requesty od automatów),
 *       reguły ochrony gałęzi (tylko repozytoria publiczne) i prywatne zgłoszenia podatności.
 *       W repozytoriach produkcyjnych reguły nie wymagają zielonego CI: Release Please i powrót prod do dev
 *       scalają pull requesty tokenem GITHUB_TOKEN, a takie pull requesty nie uruchamiają CI. Zielone CI przed
 *       scaleniem pull requestu zadania jest umową zespołu, dopóki nie mamy własnej aplikacji GitHub.
 *
 * Wymaga zalogowanego `gh` z uprawnieniem do administrowania repozytoriami.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORG = "Monorise-Team";
const PROJECT = `${ORG}/3`;

const repos = JSON.parse(readFileSync(join(ROOT, "labels/repos.json"), "utf8"));
const common = JSON.parse(readFileSync(join(ROOT, "labels/common.json"), "utf8"));

function settingsOf(repo) {
  const settings = repos[repo];
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
  if (check && differs) process.exit(1);
  if (!differs) console.log(`${repo}: formularze zgodne ze wzorcem`);
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

// ── Wywołanie ───────────────────────────────────────────────────────────────

const [command, repo, outDir] = process.argv.slice(2);
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")));
const usage = "Użycie: repo-setup.mjs forms <Repo> <katalog> [--check] | labels <Repo> [--dry-run] | protect <Repo> [--dry-run]";

if (command === "forms" && repo && outDir && !outDir.startsWith("--")) forms(repo, outDir, { check: flags.has("--check") });
else if (command === "labels" && repo) labels(repo, { dryRun: flags.has("--dry-run") });
else if (command === "protect" && repo) protect(repo, { dryRun: flags.has("--dry-run") });
else {
  console.error(usage);
  process.exit(2);
}
