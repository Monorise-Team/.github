/**
 * Wspólne reguły mapowania i zapytania GraphQL dla metadanych zgłoszeń i pull requestów
 * organizacji Monorise-Team. Bez zależności zewnętrznych (tylko standardowy Node.js ESM).
 */

export const ORG = "Monorise-Team";
export const TIMEZONE = "Europe/Warsaw";
export const RELEASE_RE = /^v(\d+)\.(\d+)\.(\d+)$/;
export const SYNC_ISSUE_TITLE_RE = /^🔧 Chore: \[\d{3,}\] Synchronizacja wspólnych plików z \.github$/;

export const FIELD_NAMES = Object.freeze({
  PRIORITY: "Priority",
  EFFORT: "Effort",
  START_DATE: "Start date",
  TARGET_DATE: "Target date",
});

export const VALID_PRIORITIES = Object.freeze(["Urgent", "High", "Medium", "Low"]);
export const VALID_EFFORTS = Object.freeze(["High", "Medium", "Low"]);
export const VALID_ISSUE_TYPES = Object.freeze([
  "Feature",
  "Bug",
  "Refactor",
  "Performance",
  "Chore",
  "Docs",
  "Test",
  "Security",
  "Spike",
]);

export const BRANCH_TYPE_TO_ISSUE_TYPE = Object.freeze({
  feature: "Feature",
  bugfix: "Bug",
  hotfix: "Bug",
  refactor: "Refactor",
  perf: "Performance",
  chore: "Chore",
  docs: "Docs",
  test: "Test",
  security: "Security",
  spike: "Spike",
});

export const LEGACY_TYPE_LABEL_TO_ISSUE_TYPE = Object.freeze({
  "type: ✨ feature": "Feature",
  "type: 🐛 bugfix": "Bug",
  "type: ♻️ refactor": "Refactor",
  "type: ⚡ perf": "Performance",
  "type: 🔧 chore": "Chore",
  "type: 📚 docs": "Docs",
  "type: 🧪 test": "Test",
  "type: 🔒 security": "Security",
  "type: 🔍 spike": "Spike",
});

export const ISSUE_TYPE_TITLE_PREFIX = Object.freeze({
  Feature: "✨ Feature",
  Bug: "🐛 Bugfix",
  Refactor: "♻️ Refactor",
  Performance: "⚡ Perf",
  Chore: "🔧 Chore",
  Docs: "📚 Docs",
  Test: "🧪 Test",
  Security: "🔒 Security",
  Spike: "🔍 Spike",
});

export const PRIORITY_MAP = Object.freeze({
  "p0-critical": "Urgent",
  "p1-high": "High",
  "p2-medium": "Medium",
  "p3-low": "Low",
});

export const PRIORITY_RANK = Object.freeze({
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
});

export const EFFORT_MAP = Object.freeze({
  mały: "Low",
  maly: "Low",
  średni: "Medium",
  sredni: "Medium",
  duży: "High",
  duzy: "High",
});

export const EFFORT_DAYS = Object.freeze({
  Low: 0,
  Medium: 2,
  High: 7,
});

// ── Daty (Europe/Warsaw) ────────────────────────────────────────────────────

const WARSAW_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isValidYmd(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

export function toWarsawDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Nieprawidłowa data: ${input}`);
  }
  const parts = Object.fromEntries(WARSAW_DATE_FMT.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(ymd, days) {
  if (!isValidYmd(ymd)) {
    throw new Error(`Nieprawidłowa data YYYY-MM-DD: ${ymd}`);
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return dt.toISOString().slice(0, 10);
}

// ── Formularze i mapowanie pól ──────────────────────────────────────────────

export function parseFormSections(body) {
  const normalized = String(body || "").replace(/\r\n/g, "\n");
  const sections = {};
  for (const chunk of normalized.split(/^### /m).slice(1)) {
    const nl = chunk.indexOf("\n");
    if (nl !== -1) {
      sections[chunk.slice(0, nl).trim()] = chunk.slice(nl + 1).trim();
    }
  }
  return sections;
}

export function sectionValues(sections, name) {
  return (sections[name] || "")
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v && v !== "_No response_");
}

export function labelNamesOf(labels) {
  return (labels || []).map((label) => (typeof label === "string" ? label : label?.name || "")).filter(Boolean);
}

export function resolvePriority({ body, currentPriority = null, isSync = false } = {}) {
  const sections = parseFormSections(body);
  for (const raw of sectionValues(sections, "Priorytet")) {
    const mapped = PRIORITY_MAP[raw.toLowerCase()];
    if (mapped) return { value: mapped, explicit: true };
  }

  if (currentPriority && VALID_PRIORITIES.includes(currentPriority)) {
    return { value: currentPriority, explicit: false };
  }

  if (isSync) return { value: "Low", explicit: false };
  return { value: null, explicit: false };
}

/**
 * Czysty helper tylko do jednorazowej migracji starych etykiet `prio:` na pole Priority.
 */
export function resolvePriorityFromLabels(labels) {
  let best = null;
  for (const name of labelNamesOf(labels)) {
    const m = /^prio:\s*(P[0-3]-[a-z]+)$/i.exec(name.trim());
    if (!m) continue;
    const mapped = PRIORITY_MAP[m[1].toLowerCase()];
    if (mapped && (best === null || PRIORITY_RANK[mapped] < PRIORITY_RANK[best])) {
      best = mapped;
    }
  }
  return best;
}

export function resolveEffort({ body, isSync = false } = {}) {
  const sections = parseFormSections(body);
  for (const raw of sectionValues(sections, "Nakład pracy")) {
    const mapped = EFFORT_MAP[raw.toLowerCase()];
    if (mapped) return { value: mapped, explicit: true };
  }
  if (isSync) return { value: "Low", explicit: false };
  return { value: "Medium", explicit: false };
}

/**
 * Czysty helper tylko do jednorazowej migracji starych etykiet `type:` na typy zgłoszeń organizacji.
 */
export function resolveIssueTypeFromLabels(labels) {
  const matches = [];
  for (const raw of labelNamesOf(labels)) {
    const name = raw.trim();
    const exact = LEGACY_TYPE_LABEL_TO_ISSUE_TYPE[name];
    if (exact) {
      matches.push(exact);
      continue;
    }
    const m = /^type:\s*(?:[^\s]+\s+)?(feature|bugfix|hotfix|refactor|perf|chore|docs|test|security|spike)$/i.exec(
      name,
    );
    if (m && BRANCH_TYPE_TO_ISSUE_TYPE[m[1].toLowerCase()]) {
      matches.push(BRANCH_TYPE_TO_ISSUE_TYPE[m[1].toLowerCase()]);
    }
  }
  if (!matches.length) return null;
  const specific = matches.find((type) => type !== "Chore" && type !== "Refactor");
  return specific ?? matches[0];
}

export function resolveIssueTypeFromBranch(branchTypeOrName) {
  const raw = String(branchTypeOrName || "").trim();
  if (!raw) return null;
  const direct = BRANCH_TYPE_TO_ISSUE_TYPE[raw.toLowerCase()];
  if (direct) return direct;
  const m = /^flow\/([a-z]+)\/\d{3,}-/.exec(raw);
  return m ? (BRANCH_TYPE_TO_ISSUE_TYPE[m[1]] ?? null) : null;
}

const TITLE_PREFIX_PATTERNS = [
  [/^(?:✨\s*)?feature:/i, "Feature"],
  [/^(?:🐛\s*)?bugfix:/i, "Bug"],
  [/^(?:🚑\s*)?hotfix:/i, "Bug"],
  [/^(?:♻️\s*)?refactor:/i, "Refactor"],
  [/^(?:⚡\s*)?perf(?:ormance)?:/i, "Performance"],
  [/^(?:🔧\s*)?chore:/i, "Chore"],
  [/^(?:📚\s*)?docs:/i, "Docs"],
  [/^(?:🧪\s*)?test:/i, "Test"],
  [/^(?:🔒\s*)?security:/i, "Security"],
  [/^(?:🔍\s*)?spike:/i, "Spike"],
];

export function resolveIssueTypeFromTitle(title) {
  const trimmed = String(title || "").trim();
  for (const [pattern, type] of TITLE_PREFIX_PATTERNS) {
    if (pattern.test(trimmed)) return type;
  }
  return null;
}

export function resolveIssueType({ currentType = null, body = "", title = "", isSync = false } = {}) {
  const current = typeof currentType === "string" ? currentType.trim() : currentType?.name?.trim() || null;
  if (isSync) return "Chore";

  const sections = parseFormSections(body);
  const kind = sectionValues(sections, "Rodzaj")[0] || "";
  if (/^Wydajno/i.test(kind)) return "Performance";
  if (/^Testy/i.test(kind)) return "Test";
  if (/^Refaktor/i.test(kind) && (!current || current === "Performance")) return "Refactor";
  if (/^(Zależno|Zalezno|Build|Narzędz|Narzedz|Sprząt|Sprzat)/i.test(kind) && (!current || current === "Test")) {
    return "Chore";
  }

  if (current) return current;

  const fromTitle = resolveIssueTypeFromTitle(title);
  if (fromTitle) return fromTitle;

  if ("Kroki do odtworzenia" in sections || "Czego się spodziewasz" in sections) return "Bug";
  if ("Kryteria akceptacji" in sections) return "Feature";
  if ("Limit czasu" in sections) return "Spike";
  if ("Potwierdzenie jawności" in sections || "Słabość i jej skutek" in sections) return "Security";
  if ("Gdzie" in sections && "Co jest nie tak" in sections) return "Docs";
  if ("Co trzeba zrobić i dlaczego teraz" in sections) return "Chore";
  if ("Co jest nie tak i dlaczego to boli" in sections) return "Refactor";

  return null;
}

export function isBotAuthor(author) {
  if (!author) return false;
  if (author.__typename === "Bot" || author.type === "Bot") return true;
  return /\[bot\]$/i.test(author.login || "");
}

export function isSyncIssue(issue) {
  const title = issue?.title || "";
  return SYNC_ISSUE_TITLE_RE.test(title) || title === "Synchronizacja wspólnych plików z .github";
}

// ── Wersje, tagi wydań i milestone ──────────────────────────────────────────

export function parseReleaseVersion(title) {
  const m = RELEASE_RE.exec(String(title || "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareReleaseVersions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function findNearestOpenMilestone(milestones) {
  const open = (milestones || [])
    .filter((m) => String(m?.state || "").toLowerCase() === "open" && parseReleaseVersion(m?.title))
    .sort((a, b) => compareReleaseVersions(parseReleaseVersion(a.title), parseReleaseVersion(b.title)));
  return open[0] ?? null;
}

export function findNewestReleaseTag(tags) {
  let newest = null;
  let newestVersion = null;
  for (const tag of tags || []) {
    const version = parseReleaseVersion(tag?.name);
    if (!version) continue;
    const date = tag?.target?.tagger?.date || tag?.target?.target?.committedDate || tag?.target?.committedDate || tag?.date || null;
    if (!date) continue;
    if (!newestVersion || compareReleaseVersions(version, newestVersion) > 0) {
      newest = { name: tag.name, date };
      newestVersion = version;
    }
  }
  return newest;
}

export function shouldAssignMilestone(issue, { newestReleaseTagDate = null } = {}) {
  if (!issue || issue.milestone) return false;
  const state = String(issue.state || "").toUpperCase();
  const reason = String(issue.stateReason ?? issue.state_reason ?? "").toUpperCase();
  if (state === "CLOSED") {
    if (reason === "NOT_PLANNED") return false;
    if (!newestReleaseTagDate) return true;
    const closedAt = issue.closedAt ?? issue.closed_at;
    if (!closedAt) return false;
    return new Date(closedAt).getTime() > new Date(newestReleaseTagDate).getTime();
  }
  return true;
}

// ── Zależności (relacje między zgłoszeniami) ────────────────────────────────

export function issueRefKey(ref) {
  return `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}#${ref.number}`;
}

export function formatIssueRef(ref, { defaultOwner = ORG, defaultRepo = "" } = {}) {
  if (
    ref.owner.toLowerCase() === defaultOwner.toLowerCase() &&
    defaultRepo &&
    ref.repo.toLowerCase() === defaultRepo.toLowerCase()
  ) {
    return `#${ref.number}`;
  }
  if (ref.owner.toLowerCase() === defaultOwner.toLowerCase()) {
    return `${ref.repo}#${ref.number}`;
  }
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}

export function parseIssueRef(raw, { defaultOwner = ORG, defaultRepo = "", allowBareNumber = false } = {}) {
  let token = String(raw || "").trim();
  if (!token) return null;
  token = token.replace(/^[`<]+/, "").replace(/[`>.,;)]+$/, "").trim();
  if (!token) return null;

  // Pełny adres URL zgłoszenia na GitHubie
  const urlMatch = /^https?:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/issues\/(\d+)(?:[/?#]\S*)?(?:\s|$)/.exec(
    token,
  );
  if (urlMatch) {
    const number = Number(urlMatch[3]);
    return number > 0 ? { owner: urlMatch[1], repo: urlMatch[2], number } : null;
  }

  // Owner/Repo#123
  const fullMatch = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)#(\d+)(?:$|[\s.;:()—–-])/.exec(token);
  if (fullMatch) {
    const number = Number(fullMatch[3]);
    return number > 0 ? { owner: fullMatch[1], repo: fullMatch[2], number } : null;
  }

  // Repo#123
  const repoMatch = /^([A-Za-z0-9._-]+)#(\d+)(?:$|[\s.;:()—–-])/.exec(token);
  if (repoMatch && defaultOwner) {
    const number = Number(repoMatch[2]);
    return number > 0 ? { owner: defaultOwner, repo: repoMatch[1], number } : null;
  }

  // #123
  const localMatch = /^#(\d+)(?:$|[\s.;:()—–-])/.exec(token);
  if (localMatch && defaultOwner && defaultRepo) {
    const number = Number(localMatch[1]);
    return number > 0 ? { owner: defaultOwner, repo: defaultRepo, number } : null;
  }

  // Sama liczba (np. w opcjach CLI --blocked-by 12)
  if (allowBareNumber && defaultOwner && defaultRepo) {
    const numMatch = /^(\d+)$/.exec(token);
    if (numMatch) {
      const number = Number(numMatch[1]);
      return number > 0 ? { owner: defaultOwner, repo: defaultRepo, number } : null;
    }
  }

  return null;
}

export function parseRelations(body, { defaultOwner = ORG, defaultRepo = "", selfNumber = null } = {}) {
  const sections = parseFormSections(body);
  const raw = sections["Zależności"];
  const blockedBy = [];
  const parents = [];
  if (!raw) return { blockedBy, parents };

  const selfKey =
    selfNumber && defaultOwner && defaultRepo
      ? issueRefKey({ owner: defaultOwner, repo: defaultRepo, number: Number(selfNumber) })
      : null;
  const seenBlocked = new Set();
  const seenParents = new Set();

  for (const line of raw.split("\n")) {
    const m = /^\s*(?:[-*]\s+)?(Czeka na|Cz[ęe][śs][ćc]):\s*(.+)$/i.exec(line);
    if (!m) continue;
    const isBlockedBy = /^czeka/i.test(m[1]);
    const list = isBlockedBy ? blockedBy : parents;
    const seen = isBlockedBy ? seenBlocked : seenParents;

    for (const part of m[2].split(",")) {
      const ref = parseIssueRef(part, { defaultOwner, defaultRepo });
      if (!ref) continue;
      const key = issueRefKey(ref);
      if (key === selfKey || seen.has(key)) continue;
      seen.add(key);
      list.push(ref);
    }
  }

  return { blockedBy, parents };
}

// ── Issue fields: odczyt, planowanie i budowanie wejścia GraphQL ────────────

export function extractCurrentFieldValues(nodes) {
  const values = {};
  for (const node of nodes || []) {
    const fieldName = node?.field?.name;
    if (!fieldName) continue;
    if (typeof node.name === "string" && node.name) {
      values[fieldName] = node.name;
    } else if (typeof node.value === "string" && node.value) {
      values[fieldName] = node.value.slice(0, 10);
    }
  }
  return values;
}

export function indexOrgIssueFields(org) {
  const fields = new Map();
  for (const node of org?.issueFields?.nodes || []) {
    if (!node?.id || !node?.name) continue;
    if (node.__typename === "IssueFieldSingleSelect" || Array.isArray(node.options)) {
      const options = new Map();
      for (const opt of node.options || []) {
        if (opt?.id && opt?.name) options.set(opt.name, opt.id);
      }
      fields.set(node.name, { id: node.id, type: "single_select", options });
    } else if (node.__typename === "IssueFieldDate") {
      fields.set(node.name, { id: node.id, type: "date" });
    }
  }
  return fields;
}

export function planIssueFieldUpdates({
  body = "",
  state = "OPEN",
  createdAt,
  closedAt = null,
  currentFields = {},
  isSync = false,
  overwriteFromSource = false,
  overrides = {},
  onlyTargetOnClose = false,
  now = null,
} = {}) {
  const updates = {};
  const effective = { ...currentFields };

  if (onlyTargetOnClose) {
    if (!currentFields[FIELD_NAMES.TARGET_DATE]) {
      const target = toWarsawDate(closedAt || now || new Date());
      updates[FIELD_NAMES.TARGET_DATE] = target;
      effective[FIELD_NAMES.TARGET_DATE] = target;
    }
    return { updates, effective };
  }

  // Priority
  const prioritySource = resolvePriority({
    body,
    currentPriority: currentFields[FIELD_NAMES.PRIORITY] || null,
    isSync,
  });
  if (overrides.priority) {
    effective[FIELD_NAMES.PRIORITY] = overrides.priority;
    if (currentFields[FIELD_NAMES.PRIORITY] !== overrides.priority) {
      updates[FIELD_NAMES.PRIORITY] = overrides.priority;
    }
  } else if (!currentFields[FIELD_NAMES.PRIORITY]) {
    if (prioritySource.value) {
      updates[FIELD_NAMES.PRIORITY] = prioritySource.value;
      effective[FIELD_NAMES.PRIORITY] = prioritySource.value;
    }
  } else if (
    overwriteFromSource &&
    prioritySource.explicit &&
    prioritySource.value &&
    currentFields[FIELD_NAMES.PRIORITY] !== prioritySource.value
  ) {
    updates[FIELD_NAMES.PRIORITY] = prioritySource.value;
    effective[FIELD_NAMES.PRIORITY] = prioritySource.value;
  }

  // Effort
  const effortSource = resolveEffort({ body, isSync });
  if (overrides.effort) {
    effective[FIELD_NAMES.EFFORT] = overrides.effort;
    if (currentFields[FIELD_NAMES.EFFORT] !== overrides.effort) {
      updates[FIELD_NAMES.EFFORT] = overrides.effort;
    }
  } else if (!currentFields[FIELD_NAMES.EFFORT]) {
    updates[FIELD_NAMES.EFFORT] = effortSource.value;
    effective[FIELD_NAMES.EFFORT] = effortSource.value;
  } else if (
    overwriteFromSource &&
    effortSource.explicit &&
    currentFields[FIELD_NAMES.EFFORT] !== effortSource.value
  ) {
    updates[FIELD_NAMES.EFFORT] = effortSource.value;
    effective[FIELD_NAMES.EFFORT] = effortSource.value;
  }

  // Start date
  if (overrides.start) {
    effective[FIELD_NAMES.START_DATE] = overrides.start;
    if (currentFields[FIELD_NAMES.START_DATE] !== overrides.start) {
      updates[FIELD_NAMES.START_DATE] = overrides.start;
    }
  } else if (!currentFields[FIELD_NAMES.START_DATE] && createdAt) {
    const start = toWarsawDate(createdAt);
    updates[FIELD_NAMES.START_DATE] = start;
    effective[FIELD_NAMES.START_DATE] = start;
  }

  // Target date
  if (overrides.target) {
    effective[FIELD_NAMES.TARGET_DATE] = overrides.target;
    if (currentFields[FIELD_NAMES.TARGET_DATE] !== overrides.target) {
      updates[FIELD_NAMES.TARGET_DATE] = overrides.target;
    }
  } else if (!currentFields[FIELD_NAMES.TARGET_DATE]) {
    const isClosed = String(state || "").toUpperCase() === "CLOSED";
    if (isClosed && closedAt) {
      const target = toWarsawDate(closedAt);
      updates[FIELD_NAMES.TARGET_DATE] = target;
      effective[FIELD_NAMES.TARGET_DATE] = target;
    } else if (effective[FIELD_NAMES.START_DATE]) {
      const days = EFFORT_DAYS[effective[FIELD_NAMES.EFFORT]] ?? EFFORT_DAYS.Medium;
      const target = addDays(effective[FIELD_NAMES.START_DATE], days);
      updates[FIELD_NAMES.TARGET_DATE] = target;
      effective[FIELD_NAMES.TARGET_DATE] = target;
    }
  }

  return { updates, effective };
}

export function planSyncIssueFieldUpdates({ currentFields = {}, today = toWarsawDate(new Date()) } = {}) {
  const wanted = {
    [FIELD_NAMES.PRIORITY]: "Low",
    [FIELD_NAMES.EFFORT]: "Low",
    [FIELD_NAMES.START_DATE]: today,
    [FIELD_NAMES.TARGET_DATE]: today,
  };
  const updates = {};
  for (const [name, value] of Object.entries(wanted)) {
    if (!currentFields[name]) updates[name] = value;
  }
  return updates;
}

export function buildSetIssueFieldsInput(updates, orgFields) {
  const inputs = [];
  const applied = [];
  const skipped = [];

  for (const [fieldName, value] of Object.entries(updates || {})) {
    if (!value) continue;
    const field = orgFields.get(fieldName);
    if (!field) {
      skipped.push(`${fieldName} (brak pola w organizacji)`);
      continue;
    }
    if (field.type === "single_select") {
      const optionId = field.options.get(value);
      if (!optionId) {
        skipped.push(`${fieldName}=${value} (brak opcji w organizacji)`);
        continue;
      }
      inputs.push({ fieldId: field.id, singleSelectOptionId: optionId });
      applied.push(`${fieldName}=${value}`);
    } else if (field.type === "date") {
      inputs.push({ fieldId: field.id, dateValue: value });
      applied.push(`${fieldName}=${value}`);
    }
  }

  return { inputs, applied, skipped };
}

// ── Pull request: etykiety, milestone i osoba przypisana ────────────────────

export function planPullRequestUpdates(
  pr,
  { repoOwner = ORG, repoName = "", repoLabels = null, nearestOpenMilestone = null, assignedMilestones = null } = {},
) {
  const closingIssues = pr?.closingIssuesReferences?.nodes || [];
  if (!closingIssues.length) {
    return { addLabels: [], milestone: null, assignee: null };
  }

  const haveLabels = new Set(labelNamesOf(pr.labels?.nodes ?? pr.labels));

  const addLabels = [];
  const addedSet = new Set();

  for (const issue of closingIssues) {
    for (const name of labelNamesOf(issue.labels?.nodes ?? issue.labels)) {
      if (!name.startsWith("area: ")) continue;
      if (haveLabels.has(name) || addedSet.has(name)) continue;
      if (repoLabels && !repoLabels.has(name)) continue;
      addedSet.add(name);
      addLabels.push(name);
    }
  }

  let milestone = null;
  if (!pr.milestone) {
    const sameRepoIssues = closingIssues.filter(
      (issue) =>
        !issue.repository ||
        (issue.repository.owner?.login?.toLowerCase() === repoOwner.toLowerCase() &&
          issue.repository.name?.toLowerCase() === repoName.toLowerCase()),
    );
    for (const issue of sameRepoIssues) {
      const candidate = issue.milestone || assignedMilestones?.get(issue.number) || null;
      if (candidate?.number) {
        milestone = candidate;
        break;
      }
    }
    if (!milestone && String(pr.state || "").toUpperCase() === "OPEN" && nearestOpenMilestone) {
      milestone = nearestOpenMilestone;
    }
  }

  const assignees = pr.assignees?.nodes ?? pr.assignees ?? [];
  const assignee = !assignees.length && pr.author && !isBotAuthor(pr.author) && pr.author.login ? pr.author.login : null;

  return { addLabels, milestone, assignee };
}

// ── Wspólne zapytania i mutacje GraphQL ─────────────────────────────────────

export const ORG_ISSUE_FIELDS_QUERY = `
  query($org: String!) {
    organization(login: $org) {
      issueFields(first: 20) {
        nodes {
          __typename
          ... on IssueFieldSingleSelect {
            id
            name
            options {
              id
              name
            }
          }
          ... on IssueFieldDate {
            id
            name
          }
        }
      }
    }
  }
`;

export const ISSUE_FIELD_VALUES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        createdAt
        closedAt
        issueType {
          name
        }
        labels(first: 50) {
          nodes {
            name
          }
        }
        issueFieldValues(first: 20) {
          nodes {
            ... on IssueFieldSingleSelectValue {
              name
              field {
                ... on IssueFieldSingleSelect {
                  name
                }
              }
            }
            ... on IssueFieldDateValue {
              value
              field {
                ... on IssueFieldDate {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const ISSUE_RELATIONS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        blockedBy(first: 50) {
          nodes {
            number
            repository {
              name
              owner {
                login
              }
            }
          }
        }
        parent {
          number
          repository {
            name
            owner {
              login
            }
          }
        }
      }
    }
  }
`;

export const ISSUE_NODE_ID_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
      }
    }
  }
`;

export const SET_ISSUE_FIELD_VALUE_MUTATION = `
  mutation($issueId: ID!, $issueFields: [IssueFieldCreateOrUpdateInput!]!) {
    setIssueFieldValue(input: { issueId: $issueId, issueFields: $issueFields }) {
      issue {
        number
      }
    }
  }
`;

export const ADD_BLOCKED_BY_MUTATION = `
  mutation($issueId: ID!, $blockingIssueId: ID!) {
    addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
      issue {
        number
      }
    }
  }
`;

export const ADD_SUB_ISSUE_MUTATION = `
  mutation($parentId: ID!, $subIssueId: ID!) {
    addSubIssue(input: { issueId: $parentId, subIssueId: $subIssueId }) {
      issue {
        number
      }
    }
  }
`;

export const PR_CLOSING_ISSUES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        closingIssuesReferences(first: 20) {
          nodes {
            id
            number
            createdAt
            repository {
              name
              owner {
                login
              }
            }
            issueFieldValues(first: 20) {
              nodes {
                ... on IssueFieldDateValue {
                  value
                  field {
                    ... on IssueFieldDate {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
