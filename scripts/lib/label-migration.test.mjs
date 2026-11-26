import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterSafeLabelsToRemove,
  findLeftoverLegacyLabels,
  formatIssueMigrationSummary,
  formatPrMigrationSummary,
  isAutoreleaseLabel,
  isLegacyProcessLabel,
  planIssueLabelMigration,
  planLabelSync,
  planPrLabelMigration,
} from "./label-migration.mjs";

describe("label classification helpers", () => {
  it("recognizes autorelease: labels", () => {
    assert.equal(isAutoreleaseLabel("autorelease: pending"), true);
    assert.equal(isAutoreleaseLabel("autorelease: tagged"), true);
    assert.equal(isAutoreleaseLabel("Autorelease: custom"), true);
    assert.equal(isAutoreleaseLabel("area: release"), false);
    assert.equal(isAutoreleaseLabel("dependencies"), false);
  });

  it("recognizes legacy type:, prio: and meta: labels", () => {
    assert.equal(isLegacyProcessLabel("type: ✨ feature"), true);
    assert.equal(isLegacyProcessLabel("prio: P1-high"), true);
    assert.equal(isLegacyProcessLabel("meta: ❓ needs triage"), true);
    assert.equal(isLegacyProcessLabel("area: web"), false);
    assert.equal(isLegacyProcessLabel("dependencies"), false);
    assert.equal(isLegacyProcessLabel("good first issue"), false);
    assert.equal(isLegacyProcessLabel("help wanted"), false);
    assert.equal(isLegacyProcessLabel("autorelease: pending"), false);
  });

  it("lists unique sorted leftover legacy labels for audit", () => {
    assert.deepEqual(
      findLeftoverLegacyLabels([
        { name: "area: web" },
        { name: "prio: P2-medium" },
        { name: "dependencies" },
        { name: "type: 🐛 bugfix" },
        { name: "meta: 🚧 blocked" },
        { name: "autorelease: pending" },
        { name: "prio: P2-medium" },
      ]),
      ["meta: 🚧 blocked", "prio: P2-medium", "type: 🐛 bugfix"],
    );
    assert.deepEqual(findLeftoverLegacyLabels(["area: web", "dependencies", "autorelease: tagged"]), []);
  });
});

describe("planLabelSync", () => {
  const commonLabels = [
    { name: "dependencies", color: "0366D6", description: "Aktualizacje zależności (Renovate)" },
    { name: "good first issue", color: "7057FF", description: "Dobre pierwsze zadanie dla nowej osoby w repozytorium" },
    { name: "help wanted", color: "008672", description: "Zadanie otwarte do wzięcia z zewnątrz" },
  ];
  const areas = [
    { name: "web", description: "Aplikacja webowa" },
    { name: "api", description: "Serwer API" },
  ];

  it("creates missing labels, updates changed ones, deletes obsolete labels, and preserves autorelease:*", () => {
    const existingLabels = [
      { name: "dependencies", color: "0366d6", description: "Aktualizacje zależności (Renovate)" },
      { name: "good first issue", color: "7057FF", description: "Good for newcomers" },
      { name: "area: web", color: "8250DF", description: "Aplikacja webowa" },
      { name: "type: ✨ feature", color: "0E5FD8", description: "Old" },
      { name: "prio: P1-high", color: "D93F0B", description: "Old" },
      { name: "meta: ❓ needs triage", color: "EAC54F", description: "Old" },
      { name: "bug", color: "d73a4a", description: "GitHub default" },
      { name: "enhancement", color: "a2eeef", description: "GitHub default" },
      { name: "accessibility", color: "123456", description: "Obsolete" },
      { name: "area: removed", color: "8250DF", description: "Removed area" },
      { name: "autorelease: pending", color: "ededed", description: "" },
      { name: "autorelease: tagged", color: "ededed", description: "" },
    ];

    const plan = planLabelSync({ existingLabels, commonLabels, areas });

    assert.deepEqual(
      plan.toCreate.map((l) => l.name),
      ["help wanted", "area: api"],
    );
    assert.deepEqual(plan.toUpdate, [
      {
        currentName: "good first issue",
        name: "good first issue",
        color: "7057FF",
        description: "Dobre pierwsze zadanie dla nowej osoby w repozytorium",
      },
    ]);
    assert.deepEqual(plan.unchanged, ["dependencies", "area: web"]);
    assert.deepEqual(plan.toDelete, [
      "accessibility",
      "area: removed",
      "bug",
      "enhancement",
      "meta: ❓ needs triage",
      "prio: P1-high",
      "type: ✨ feature",
    ]);
    assert.deepEqual(plan.preservedAutorelease, ["autorelease: pending", "autorelease: tagged"]);
    assert.equal(plan.wantedCount, 5);
  });

  it("never creates autorelease: labels even if accidentally passed in commonLabels", () => {
    const plan = planLabelSync({
      existingLabels: [],
      commonLabels: [...commonLabels, { name: "autorelease: pending", color: "000000", description: "" }],
      areas: [],
    });
    assert.deepEqual(
      plan.toCreate.map((l) => l.name),
      ["dependencies", "good first issue", "help wanted"],
    );
  });
});

describe("planIssueLabelMigration", () => {
  it("overwrites Chore (former Task) with type from type: label, fills empty Priority, and removes legacy labels", () => {
    const plan = planIssueLabelMigration({
      number: 12,
      issueType: { name: "Chore" },
      labels: {
        nodes: [
          { name: "type: 📚 docs" },
          { name: "prio: P1-high" },
          { name: "meta: 🚧 blocked" },
          { name: "area: web" },
        ],
      },
      issueFieldValues: { nodes: [] },
    });

    assert.deepEqual(plan, {
      currentType: "Chore",
      setIssueType: "Docs",
      currentPriority: null,
      setPriority: "High",
      removeLabels: ["type: 📚 docs", "prio: P1-high", "meta: 🚧 blocked"],
      hasChanges: true,
    });
    assert.equal(
      formatIssueMigrationSummary(plan),
      "typ Chore -> Docs; Priority -> High; usuwam etykiety: type: 📚 docs, prio: P1-high, meta: 🚧 blocked",
    );
  });

  it("does not overwrite existing Priority and avoids redundant type change when already matching", () => {
    const plan = planIssueLabelMigration({
      number: 15,
      issueType: { name: "Feature" },
      labels: { nodes: [{ name: "type: ✨ feature" }, { name: "prio: P3-low" }, { name: "area: api" }] },
      issueFieldValues: {
        nodes: [{ name: "Urgent", field: { name: "Priority" } }],
      },
    });

    assert.equal(plan.setIssueType, null);
    assert.equal(plan.setPriority, null);
    assert.deepEqual(plan.removeLabels, ["type: ✨ feature", "prio: P3-low"]);
    assert.equal(plan.hasChanges, true);
    assert.equal(formatIssueMigrationSummary(plan), "usuwam etykiety: type: ✨ feature, prio: P3-low");
  });

  it("leaves issue type alone when both current type and type: label are absent", () => {
    const plan = planIssueLabelMigration({
      number: 20,
      issueType: null,
      labels: { nodes: [{ name: "prio: P2-medium" }, { name: "area: web" }] },
      issueFieldValues: { nodes: [] },
    });

    assert.equal(plan.setIssueType, null);
    assert.equal(plan.setPriority, "Medium");
    assert.deepEqual(plan.removeLabels, ["prio: P2-medium"]);
    assert.equal(plan.hasChanges, true);
  });

  it("is idempotent on already-migrated issues", () => {
    const plan = planIssueLabelMigration({
      number: 25,
      issueType: { name: "Performance" },
      labels: { nodes: [{ name: "area: web" }, { name: "dependencies" }] },
      issueFieldValues: { nodes: [{ name: "High", field: { name: "Priority" } }] },
    });

    assert.equal(plan.setIssueType, null);
    assert.equal(plan.setPriority, null);
    assert.deepEqual(plan.removeLabels, []);
    assert.equal(plan.hasChanges, false);
    assert.equal(formatIssueMigrationSummary(plan), "");
  });

  it("keeps type: or prio: labels when setting the replacement field failed", () => {
    const remove = ["type: 📚 docs", "prio: P1-high", "meta: ❓ needs triage"];
    assert.deepEqual(filterSafeLabelsToRemove(remove, { typeOk: false, priorityOk: true }), [
      "prio: P1-high",
      "meta: ❓ needs triage",
    ]);
    assert.deepEqual(filterSafeLabelsToRemove(remove, { typeOk: true, priorityOk: false }), [
      "type: 📚 docs",
      "meta: ❓ needs triage",
    ]);
    assert.deepEqual(filterSafeLabelsToRemove(remove, { typeOk: false, priorityOk: false }), [
      "meta: ❓ needs triage",
    ]);
    assert.deepEqual(filterSafeLabelsToRemove(remove, { typeOk: true, priorityOk: true }), remove);
  });
});

describe("planPrLabelMigration", () => {
  it("removes type:, prio: and meta: labels while keeping area:, dependencies and autorelease:*", () => {
    const plan = planPrLabelMigration({
      number: 30,
      labels: {
        nodes: [
          { name: "type: 🔧 chore" },
          { name: "prio: P3-low" },
          { name: "meta: 💥 breaking change" },
          { name: "area: web" },
          { name: "dependencies" },
          { name: "autorelease: pending" },
        ],
      },
    });

    assert.deepEqual(plan.removeLabels, ["type: 🔧 chore", "prio: P3-low", "meta: 💥 breaking change"]);
    assert.equal(plan.hasChanges, true);
    assert.equal(
      formatPrMigrationSummary(plan),
      "usuwam etykiety: type: 🔧 chore, prio: P3-low, meta: 💥 breaking change",
    );
  });

  it("is idempotent on clean PRs", () => {
    const plan = planPrLabelMigration({
      number: 31,
      labels: { nodes: [{ name: "area: web" }, { name: "autorelease: tagged" }] },
    });
    assert.deepEqual(plan.removeLabels, []);
    assert.equal(plan.hasChanges, false);
    assert.equal(formatPrMigrationSummary(plan), "");
  });
});
