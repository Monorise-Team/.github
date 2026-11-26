import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRANCH_TYPE_TO_ISSUE_TYPE,
  ISSUE_TYPE_TITLE_PREFIX,
  LEGACY_TYPE_LABEL_TO_ISSUE_TYPE,
  VALID_ISSUE_TYPES,
  addDays,
  buildSetIssueFieldsInput,
  extractCurrentFieldValues,
  findNearestOpenMilestone,
  findNewestReleaseTag,
  formatIssueRef,
  indexOrgIssueFields,
  isBotAuthor,
  isSyncIssue,
  isValidYmd,
  parseFormSections,
  parseIssueRef,
  parseRelations,
  planIssueFieldUpdates,
  planPullRequestUpdates,
  planSyncIssueFieldUpdates,
  resolveEffort,
  resolveIssueType,
  resolveIssueTypeFromBranch,
  resolveIssueTypeFromLabels,
  resolveIssueTypeFromTitle,
  resolvePriority,
  resolvePriorityFromLabels,
  shouldAssignMilestone,
  toWarsawDate,
} from "./issue-meta.mjs";

describe("priority and effort mapping", () => {
  it("maps Priority from form section Priorytet", () => {
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\nP0-critical" }), { value: "Urgent", explicit: true });
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\nP1-high" }), { value: "High", explicit: true });
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\nP2-medium" }), { value: "Medium", explicit: true });
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\nP3-low" }), { value: "Low", explicit: true });
  });

  it("falls back to existing Priority field when form section is missing, never labels", () => {
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\n_No response_", currentPriority: "High" }), {
      value: "High",
      explicit: false,
    });
    assert.deepEqual(resolvePriority({ body: "", currentPriority: "Urgent" }), {
      value: "Urgent",
      explicit: false,
    });
    assert.deepEqual(resolvePriority({ body: "### Priorytet\n\nP1-high", currentPriority: "Low" }), {
      value: "High",
      explicit: true,
    });
    // Labels are ignored by resolvePriority; only the migration helper reads prio: labels
    assert.deepEqual(resolvePriority({ body: "", labels: ["prio: P0-critical"] }), { value: null, explicit: false });
  });

  it("resolves Priority from legacy prio: labels via migration helper", () => {
    assert.equal(resolvePriorityFromLabels(["prio: P0-critical"]), "Urgent");
    assert.equal(resolvePriorityFromLabels([{ name: "type: 🐛 bugfix" }, { name: "prio: P1-high" }]), "High");
    assert.equal(resolvePriorityFromLabels(["prio: P3-low", "prio: P1-high"]), "High");
    assert.equal(resolvePriorityFromLabels(["area: web", "dependencies"]), null);
  });

  it("handles missing Priority and sync issue fallback", () => {
    assert.deepEqual(resolvePriority({ body: "" }), { value: null, explicit: false });
    assert.deepEqual(resolvePriority({ body: "", isSync: true }), { value: "Low", explicit: false });
  });

  it("maps Effort from form section Nakład pracy with Medium default", () => {
    assert.deepEqual(resolveEffort({ body: "### Nakład pracy\n\nMały" }), { value: "Low", explicit: true });
    assert.deepEqual(resolveEffort({ body: "### Nakład pracy\n\nŚredni" }), { value: "Medium", explicit: true });
    assert.deepEqual(resolveEffort({ body: "### Nakład pracy\n\nDuży" }), { value: "High", explicit: true });
    assert.deepEqual(resolveEffort({ body: "### Nakład pracy\n\n_No response_" }), {
      value: "Medium",
      explicit: false,
    });
    assert.deepEqual(resolveEffort({ body: "" }), { value: "Medium", explicit: false });
    assert.deepEqual(resolveEffort({ body: "", isSync: true }), { value: "Low", explicit: false });
  });

  it("handles CRLF line endings in form sections", () => {
    const sections = parseFormSections("### Priorytet\r\n\r\nP1-high\r\n\r\n### Nakład pracy\r\n\r\nDuży\r\n");
    assert.equal(sections["Priorytet"], "P1-high");
    assert.equal(sections["Nakład pracy"], "Duży");
  });
});

describe("issue type mapping", () => {
  it("defines all 9 organization issue types and title prefixes", () => {
    assert.deepEqual(VALID_ISSUE_TYPES, [
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
    for (const type of VALID_ISSUE_TYPES) {
      assert.ok(ISSUE_TYPE_TITLE_PREFIX[type], `Missing prefix for ${type}`);
    }
    assert.equal(Object.keys(LEGACY_TYPE_LABEL_TO_ISSUE_TYPE).length, 9);
    assert.equal(BRANCH_TYPE_TO_ISSUE_TYPE.hotfix, "Bug");
  });

  it("maps all legacy type: labels to organization issue types for migration", () => {
    assert.equal(resolveIssueTypeFromLabels(["type: ✨ feature"]), "Feature");
    assert.equal(resolveIssueTypeFromLabels(["type: 🐛 bugfix"]), "Bug");
    assert.equal(resolveIssueTypeFromLabels(["type: ♻️ refactor"]), "Refactor");
    assert.equal(resolveIssueTypeFromLabels(["type: ⚡ perf"]), "Performance");
    assert.equal(resolveIssueTypeFromLabels(["type: 🔧 chore"]), "Chore");
    assert.equal(resolveIssueTypeFromLabels(["type: 📚 docs"]), "Docs");
    assert.equal(resolveIssueTypeFromLabels(["type: 🧪 test"]), "Test");
    assert.equal(resolveIssueTypeFromLabels(["type: 🔒 security"]), "Security");
    assert.equal(resolveIssueTypeFromLabels(["type: 🔍 spike"]), "Spike");
    // Prefers specific type over Chore/Refactor if both labels existed
    assert.equal(resolveIssueTypeFromLabels(["type: 🔧 chore", "type: 🧪 test"]), "Test");
    assert.equal(resolveIssueTypeFromLabels(["type: ♻️ refactor", "type: ⚡ perf"]), "Performance");
    assert.equal(resolveIssueTypeFromLabels(["area: web", "dependencies"]), null);
    assert.equal(resolveIssueTypeFromLabels([]), null);
  });

  it("maps branch types and full branch names to issue types", () => {
    assert.equal(resolveIssueTypeFromBranch("feature"), "Feature");
    assert.equal(resolveIssueTypeFromBranch("bugfix"), "Bug");
    assert.equal(resolveIssueTypeFromBranch("hotfix"), "Bug");
    assert.equal(resolveIssueTypeFromBranch("refactor"), "Refactor");
    assert.equal(resolveIssueTypeFromBranch("perf"), "Performance");
    assert.equal(resolveIssueTypeFromBranch("chore"), "Chore");
    assert.equal(resolveIssueTypeFromBranch("docs"), "Docs");
    assert.equal(resolveIssueTypeFromBranch("test"), "Test");
    assert.equal(resolveIssueTypeFromBranch("security"), "Security");
    assert.equal(resolveIssueTypeFromBranch("spike"), "Spike");
    assert.equal(resolveIssueTypeFromBranch("flow/perf/042-faster-list"), "Performance");
    assert.equal(resolveIssueTypeFromBranch("flow/hotfix/007-fix-login"), "Bug");
    assert.equal(resolveIssueTypeFromBranch("dev"), null);
  });

  it("resolves issue types from Rodzaj, sync issues, current type, title and form body", () => {
    // Chore form with Testy -> Test
    assert.equal(
      resolveIssueType({ currentType: "Chore", body: "### Rodzaj\n\nTesty, czyli nowe testy albo lepsze pokrycie" }),
      "Test",
    );
    // Editing Testy back to Build / CI -> Chore
    assert.equal(
      resolveIssueType({ currentType: "Test", body: "### Rodzaj\n\nBuild / CI, czyli potoki, skrypty, konfiguracja" }),
      "Chore",
    );
    // Refactor form with Wydajność -> Performance
    assert.equal(
      resolveIssueType({
        currentType: "Refactor",
        body: "### Rodzaj\n\nWydajność, czyli szybkość, pamięć, rozmiar paczki, koszt zapytań",
      }),
      "Performance",
    );
    // Editing Wydajność back to Refaktor -> Refactor
    assert.equal(
      resolveIssueType({
        currentType: "Performance",
        body: "### Rodzaj\n\nRefaktor, czyli struktura, czytelność, duplikacja",
      }),
      "Refactor",
    );
    // Sync issue always resolves to Chore
    assert.equal(resolveIssueType({ currentType: null, isSync: true }), "Chore");
    // Keeps existing type from form when no Rodzaj override applies
    assert.equal(resolveIssueType({ currentType: "Security", body: "### Słabość i jej skutek\n\nOpis" }), "Security");
    assert.equal(resolveIssueType({ currentType: { name: "Feature" }, body: "" }), "Feature");
    // Infers from title prefix or form signature when missing
    assert.equal(resolveIssueType({ currentType: null, title: "📚 Docs: [012] Update guide" }), "Docs");
    assert.equal(resolveIssueTypeFromTitle("🚑 Hotfix: [003] Fix outage"), "Bug");
    assert.equal(
      resolveIssueType({ currentType: null, body: "### Kroki do odtworzenia\n\n1. Kliknij" }),
      "Bug",
    );
    assert.equal(resolveIssueType({ currentType: null, body: "### Limit czasu\n\n1 dzień" }), "Spike");
    // Leaves unknown issue type unset rather than guessing
    assert.equal(resolveIssueType({ currentType: null, title: "Bez typu", body: "Opis" }), null);
  });
});

describe("date rules in Europe/Warsaw", () => {
  it("converts UTC timestamps across winter (CET, UTC+1) and summer (CEST, UTC+2) boundaries", () => {
    // Winter: 23:30 UTC is 00:30 next day in Warsaw
    assert.equal(toWarsawDate("2026-01-15T23:30:00Z"), "2026-01-16");
    assert.equal(toWarsawDate("2026-01-15T22:59:59Z"), "2026-01-15");
    // Summer: 22:30 UTC is 00:30 next day in Warsaw
    assert.equal(toWarsawDate("2026-07-15T22:30:00Z"), "2026-07-16");
    assert.equal(toWarsawDate("2026-07-15T21:59:59Z"), "2026-07-15");
  });

  it("adds calendar days without timezone drift", () => {
    assert.equal(addDays("2026-11-24", 0), "2026-11-24");
    assert.equal(addDays("2026-11-24", 2), "2026-11-26");
    assert.equal(addDays("2026-11-24", 7), "2026-12-01");
    assert.equal(addDays("2026-02-27", 2), "2026-03-01");
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  });

  it("validates YYYY-MM-DD calendar dates", () => {
    assert.equal(isValidYmd("2026-11-24"), true);
    assert.equal(isValidYmd("2024-02-29"), true);
    assert.equal(isValidYmd("2026-02-29"), false);
    assert.equal(isValidYmd("2026-13-01"), false);
    assert.equal(isValidYmd("24-11-2026"), false);
  });

  it("computes open issue Start date and Target date from Effort (+0 / +2 / +7)", () => {
    const low = planIssueFieldUpdates({
      body: "### Priorytet\n\nP3-low\n\n### Nakład pracy\n\nMały",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
    });
    assert.deepEqual(low.updates, {
      Priority: "Low",
      Effort: "Low",
      "Start date": "2026-11-24",
      "Target date": "2026-11-24",
    });

    const medium = planIssueFieldUpdates({
      body: "### Priorytet\n\nP2-medium",
      state: "OPEN",
      createdAt: "2026-11-24T23:30:00Z", // 2026-11-25 in Warsaw
    });
    assert.deepEqual(medium.updates, {
      Priority: "Medium",
      Effort: "Medium",
      "Start date": "2026-11-25",
      "Target date": "2026-11-27",
    });

    const high = planIssueFieldUpdates({
      body: "### Priorytet\n\nP1-high\n\n### Nakład pracy\n\nDuży",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
    });
    assert.deepEqual(high.updates, {
      Priority: "High",
      Effort: "High",
      "Start date": "2026-11-24",
      "Target date": "2026-12-01",
    });
  });

  it("uses closed date as Target date for closed issues when empty", () => {
    const planned = planIssueFieldUpdates({
      body: "### Priorytet\n\nP1-high\n\n### Nakład pracy\n\nDuży",
      state: "CLOSED",
      createdAt: "2026-05-01T10:00:00Z",
      closedAt: "2026-05-03T22:30:00Z", // 2026-05-04 in CEST
    });
    assert.deepEqual(planned.updates, {
      Priority: "High",
      Effort: "High",
      "Start date": "2026-05-01",
      "Target date": "2026-05-04",
    });
  });

  it("never overwrites already-set values unless edited from explicit source or CLI overrides", () => {
    const existing = {
      Priority: "Low",
      Effort: "High",
      "Start date": "2026-11-01",
      "Target date": "2026-11-10",
    };

    // Backfill / reopened: nothing overwritten
    const backfill = planIssueFieldUpdates({
      body: "### Priorytet\n\nP0-critical\n\n### Nakład pracy\n\nMały",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
      currentFields: existing,
      overwriteFromSource: false,
    });
    assert.deepEqual(backfill.updates, {});

    // Edited with explicit form changes: Priority & Effort follow form, dates preserved
    const edited = planIssueFieldUpdates({
      body: "### Priorytet\n\nP0-critical\n\n### Nakład pracy\n\nMały",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
      currentFields: existing,
      overwriteFromSource: true,
    });
    assert.deepEqual(edited.updates, { Priority: "Urgent", Effort: "Low" });

    // Edited WITHOUT explicit Nakład pracy: keeps existing Effort (does not reset to Medium)
    const editedNoEffort = planIssueFieldUpdates({
      body: "### Priorytet\n\nP1-high",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
      currentFields: existing,
      overwriteFromSource: true,
    });
    assert.deepEqual(editedNoEffort.updates, { Priority: "High" });

    // Explicit CLI overrides overwrite even existing dates and fields
    const cli = planIssueFieldUpdates({
      body: "",
      state: "OPEN",
      createdAt: "2026-11-24T10:00:00Z",
      currentFields: existing,
      overrides: { start: "2026-11-20", target: "2026-11-25", priority: "Urgent" },
    });
    assert.deepEqual(cli.updates, {
      Priority: "Urgent",
      "Start date": "2026-11-20",
      "Target date": "2026-11-25",
    });
  });

  it("fills only empty Target date on closed event mode", () => {
    const filled = planIssueFieldUpdates({
      closedAt: "2026-11-24T12:00:00Z",
      currentFields: { "Start date": "2026-11-20" },
      onlyTargetOnClose: true,
    });
    assert.deepEqual(filled.updates, { "Target date": "2026-11-24" });

    const untouched = planIssueFieldUpdates({
      closedAt: "2026-11-24T12:00:00Z",
      currentFields: { "Start date": "2026-11-20", "Target date": "2026-11-22" },
      onlyTargetOnClose: true,
    });
    assert.deepEqual(untouched.updates, {});
  });

  it("plans sync issue fields only when empty", () => {
    assert.deepEqual(planSyncIssueFieldUpdates({ currentFields: {}, today: "2026-11-24" }), {
      Priority: "Low",
      Effort: "Low",
      "Start date": "2026-11-24",
      "Target date": "2026-11-24",
    });
    assert.deepEqual(
      planSyncIssueFieldUpdates({
        currentFields: { Priority: "Low", "Start date": "2026-11-20" },
        today: "2026-11-24",
      }),
      { Effort: "Low", "Target date": "2026-11-24" },
    );
  });
});

describe("Zależności parsing", () => {
  it("parses local, cross-repo, full-qualified and URL references, including comma-separated lists", () => {
    const body = [
      "### Co trzeba zrobić",
      "",
      "Opis zadania.",
      "",
      "### Zależności",
      "",
      "Czeka na: #12, MonoriseCore#13, Monorise-Team/AvenMail#42",
      "- Czeka na: https://github.com/Monorise-Team/MonoriseShared/issues/18#issuecomment-99, .github#26",
      "Część: #4, https://github.com/Monorise-Team/MonoriseCore/issues/100",
    ].join("\n");

    const parsed = parseRelations(body, {
      defaultOwner: "Monorise-Team",
      defaultRepo: "MonoriseShared",
      selfNumber: 18,
    });

    assert.deepEqual(parsed.blockedBy, [
      { owner: "Monorise-Team", repo: "MonoriseShared", number: 12 },
      { owner: "Monorise-Team", repo: "MonoriseCore", number: 13 },
      { owner: "Monorise-Team", repo: "AvenMail", number: 42 },
      // MonoriseShared#18 skipped because selfNumber === 18
      { owner: "Monorise-Team", repo: ".github", number: 26 },
    ]);
    assert.deepEqual(parsed.parents, [
      { owner: "Monorise-Team", repo: "MonoriseShared", number: 4 },
      { owner: "Monorise-Team", repo: "MonoriseCore", number: 100 },
    ]);
  });

  it("deduplicates repeated references and ignores _No response_", () => {
    const body = [
      "### Zależności",
      "",
      "Czeka na: #5, MonoriseShared#5, https://github.com/Monorise-Team/MonoriseShared/issues/5",
      "_No response_",
    ].join("\n");
    const parsed = parseRelations(body, { defaultOwner: "Monorise-Team", defaultRepo: "MonoriseShared" });
    assert.deepEqual(parsed.blockedBy, [{ owner: "Monorise-Team", repo: "MonoriseShared", number: 5 }]);
    assert.deepEqual(parsed.parents, []);
  });

  it("parses and formats single issue refs for CLI flags", () => {
    assert.deepEqual(parseIssueRef("12", { defaultOwner: "Monorise-Team", defaultRepo: "AvenMail", allowBareNumber: true }), {
      owner: "Monorise-Team",
      repo: "AvenMail",
      number: 12,
    });
    assert.equal(parseIssueRef("12", { defaultOwner: "Monorise-Team", defaultRepo: "AvenMail" }), null);
    assert.equal(
      formatIssueRef({ owner: "Monorise-Team", repo: "AvenMail", number: 12 }, { defaultOwner: "Monorise-Team", defaultRepo: "AvenMail" }),
      "#12",
    );
    assert.equal(
      formatIssueRef({ owner: "Monorise-Team", repo: "MonoriseCore", number: 13 }, { defaultOwner: "Monorise-Team", defaultRepo: "AvenMail" }),
      "MonoriseCore#13",
    );
    assert.equal(
      formatIssueRef({ owner: "OtherOrg", repo: "Repo", number: 7 }, { defaultOwner: "Monorise-Team", defaultRepo: "AvenMail" }),
      "OtherOrg/Repo#7",
    );
  });
});

describe("milestones, tags, bots, GraphQL helpers and PR backfill", () => {
  it("picks nearest open vX.Y.Z milestone and newest release tag", () => {
    const m = findNearestOpenMilestone([
      { number: 1, title: "v0.10.0", state: "open" },
      { number: 2, title: "v0.2.0", state: "open" },
      { number: 3, title: "v0.1.0", state: "closed" },
      { number: 4, title: "Backlog", state: "open" },
    ]);
    assert.equal(m.title, "v0.2.0");

    const tag = findNewestReleaseTag([
      { name: "v0.1.0", target: { committedDate: "2026-01-10T00:00:00Z" } },
      { name: "v0.10.0", target: { tagger: { date: "2026-03-01T00:00:00Z" } } },
      { name: "v0.2.0", target: { committedDate: "2026-02-01T00:00:00Z" } },
      { name: "not-a-release", target: { committedDate: "2026-12-01T00:00:00Z" } },
    ]);
    assert.deepEqual(tag, { name: "v0.10.0", date: "2026-03-01T00:00:00Z" });
  });

  it("decides milestone assignment for open, closed and not_planned issues", () => {
    const releaseDate = "2026-03-01T12:00:00Z";
    assert.equal(shouldAssignMilestone({ state: "OPEN", milestone: null }, { newestReleaseTagDate: releaseDate }), true);
    assert.equal(shouldAssignMilestone({ state: "OPEN", milestone: { number: 1 } }, { newestReleaseTagDate: releaseDate }), false);
    assert.equal(
      shouldAssignMilestone({ state: "CLOSED", stateReason: "NOT_PLANNED", closedAt: "2026-04-01T00:00:00Z" }, { newestReleaseTagDate: releaseDate }),
      false,
    );
    assert.equal(
      shouldAssignMilestone({ state: "CLOSED", stateReason: "COMPLETED", closedAt: "2026-02-15T00:00:00Z" }, { newestReleaseTagDate: releaseDate }),
      false,
    );
    assert.equal(
      shouldAssignMilestone({ state: "CLOSED", stateReason: "COMPLETED", closedAt: "2026-03-02T00:00:00Z" }, { newestReleaseTagDate: releaseDate }),
      true,
    );
    assert.equal(
      shouldAssignMilestone({ state: "CLOSED", stateReason: "COMPLETED", closedAt: "2026-02-15T00:00:00Z" }, { newestReleaseTagDate: null }),
      true,
    );
  });

  it("identifies bots and sync issues", () => {
    assert.equal(isBotAuthor({ __typename: "Bot", login: "renovate" }), true);
    assert.equal(isBotAuthor({ __typename: "User", login: "github-actions[bot]" }), true);
    assert.equal(isBotAuthor({ __typename: "User", login: "matiqueue" }), false);
    assert.equal(isSyncIssue({ title: "🔧 Chore: [014] Synchronizacja wspólnych plików z .github" }), true);
    assert.equal(isSyncIssue({ title: "Dependency Dashboard" }), false);
  });

  it("indexes org Issue fields and builds setIssueFieldValue input", () => {
    const orgFields = indexOrgIssueFields({
      issueFields: {
        nodes: [
          {
            __typename: "IssueFieldSingleSelect",
            id: "F_PRIO",
            name: "Priority",
            options: [
              { id: "O_HIGH", name: "High" },
              { id: "O_LOW", name: "Low" },
            ],
          },
          { __typename: "IssueFieldDate", id: "F_START", name: "Start date" },
        ],
      },
    });
    const built = buildSetIssueFieldsInput(
      { Priority: "High", Effort: "Medium", "Start date": "2026-11-24" },
      orgFields,
    );
    assert.deepEqual(built.inputs, [
      { fieldId: "F_PRIO", singleSelectOptionId: "O_HIGH" },
      { fieldId: "F_START", dateValue: "2026-11-24" },
    ]);
    assert.deepEqual(built.applied, ["Priority=High", "Start date=2026-11-24"]);
    assert.equal(built.skipped.length, 1);

    const extracted = extractCurrentFieldValues([
      { name: "High", field: { name: "Priority" } },
      { value: "2026-11-24T00:00:00Z", field: { name: "Start date" } },
    ]);
    assert.deepEqual(extracted, { Priority: "High", "Start date": "2026-11-24" });
  });

  it("plans PR updates from closingIssuesReferences with area: labels only (no prio:/type:)", () => {
    const pr = {
      state: "MERGED",
      author: { __typename: "User", login: "matiqueue" },
      assignees: { nodes: [] },
      milestone: null,
      labels: { nodes: [{ name: "area: ui" }] },
      closingIssuesReferences: {
        nodes: [
          {
            number: 10,
            repository: { owner: { login: "Monorise-Team" }, name: "MonoriseShared" },
            milestone: { number: 2, title: "v0.2.0", state: "OPEN" },
            labels: {
              nodes: [
                { name: "area: auth" },
                { name: "area: ui" },
                { name: "prio: P1-high" },
                { name: "type: ✨ feature" },
              ],
            },
          },
        ],
      },
    };
    const plan = planPullRequestUpdates(pr, {
      repoOwner: "Monorise-Team",
      repoName: "MonoriseShared",
      repoLabels: new Set(["area: auth", "area: ui", "prio: P1-high", "type: ✨ feature"]),
    });
    assert.deepEqual(plan.addLabels, ["area: auth"]);
    assert.equal(plan.milestone.number, 2);
    assert.equal(plan.assignee, "matiqueue");
  });
});
