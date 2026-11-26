/**
 * Czysta logika planowania synchronizacji etykiet, audytu pozostałych starych etykiet
 * oraz jednorazowej migracji etykiet `type:`, `prio:` i `meta:` na typy zgłoszeń i pole Priority.
 */
import {
  FIELD_NAMES,
  extractCurrentFieldValues,
  labelNamesOf,
  resolveIssueTypeFromLabels,
  resolvePriorityFromLabels,
} from "./issue-meta.mjs";

export function isAutoreleaseLabel(name) {
  return /^autorelease:/i.test(String(name || "").trim());
}

export function isLegacyProcessLabel(name) {
  return /^(type|prio|meta):/i.test(String(name || "").trim());
}

export function findLeftoverLegacyLabels(labels) {
  return [...new Set(labelNamesOf(labels).filter(isLegacyProcessLabel))].sort((a, b) => a.localeCompare(b));
}

export function planLabelSync({ existingLabels = [], commonLabels = [], areas = [] } = {}) {
  const wanted = [
    ...commonLabels,
    ...areas.map((area) => ({ name: `area: ${area.name}`, color: "8250DF", description: area.description })),
  ].filter((label) => !isAutoreleaseLabel(label.name));

  const existingByLower = new Map();
  for (const label of existingLabels) {
    if (!label?.name) continue;
    existingByLower.set(label.name.toLowerCase(), label);
  }

  const wantedLower = new Set(wanted.map((label) => label.name.toLowerCase()));
  const toCreate = [];
  const toUpdate = [];
  const unchanged = [];

  for (const label of wanted) {
    const current = existingByLower.get(label.name.toLowerCase());
    if (!current) {
      toCreate.push(label);
      continue;
    }
    const sameName = current.name === label.name;
    const sameColor = String(current.color || "").toLowerCase() === String(label.color || "").toLowerCase();
    const sameDesc = (current.description ?? "") === (label.description ?? "");
    if (sameName && sameColor && sameDesc) {
      unchanged.push(label.name);
    } else {
      toUpdate.push({
        currentName: current.name,
        name: label.name,
        color: label.color,
        description: label.description ?? "",
      });
    }
  }

  const toDelete = [];
  const preservedAutorelease = [];
  for (const label of existingLabels) {
    if (!label?.name) continue;
    if (wantedLower.has(label.name.toLowerCase())) continue;
    if (isAutoreleaseLabel(label.name)) {
      preservedAutorelease.push(label.name);
      continue;
    }
    toDelete.push(label.name);
  }

  toDelete.sort((a, b) => a.localeCompare(b));
  preservedAutorelease.sort((a, b) => a.localeCompare(b));

  return {
    toCreate,
    toUpdate,
    unchanged,
    toDelete,
    preservedAutorelease,
    wantedCount: wanted.length,
  };
}

export function planIssueLabelMigration(issue) {
  const labelNames = labelNamesOf(issue?.labels?.nodes ?? issue?.labels);
  const currentType =
    issue?.issueType?.name ?? (typeof issue?.type === "string" ? issue.type : issue?.type?.name) ?? null;
  const currentFields = issue?.currentFields ?? extractCurrentFieldValues(issue?.issueFieldValues?.nodes || []);
  const currentPriority = currentFields[FIELD_NAMES.PRIORITY] ?? null;

  // Etykieta type: wygrywa z obecnym typem (starsze zgłoszenia dostały dawne Task, dziś Chore).
  // Gdy brak zarówno typu, jak i etykiety type:, typ zostaje bez zmian.
  const typeFromLabel = resolveIssueTypeFromLabels(labelNames);
  const setIssueType = typeFromLabel && typeFromLabel !== currentType ? typeFromLabel : null;

  // Pole Priority uzupełniamy z etykiety prio: tylko wtedy, gdy jest puste.
  const priorityFromLabel = resolvePriorityFromLabels(labelNames);
  const setPriority = !currentPriority && priorityFromLabel ? priorityFromLabel : null;

  const removeLabels = labelNames.filter(isLegacyProcessLabel);
  const hasChanges = Boolean(setIssueType || setPriority || removeLabels.length);

  return {
    currentType,
    setIssueType,
    currentPriority,
    setPriority,
    removeLabels,
    hasChanges,
  };
}

export function filterSafeLabelsToRemove(removeLabels, { typeOk = true, priorityOk = true } = {}) {
  return (removeLabels || []).filter((name) => {
    const trimmed = String(name || "").trim();
    if (!typeOk && /^type:/i.test(trimmed)) return false;
    if (!priorityOk && /^prio:/i.test(trimmed)) return false;
    return true;
  });
}

export function planPrLabelMigration(pr) {
  const labelNames = labelNamesOf(pr?.labels?.nodes ?? pr?.labels);
  const removeLabels = labelNames.filter(isLegacyProcessLabel);
  return {
    removeLabels,
    hasChanges: removeLabels.length > 0,
  };
}

export function formatIssueMigrationSummary(plan) {
  const parts = [];
  if (plan.setIssueType) {
    parts.push(plan.currentType ? `typ ${plan.currentType} -> ${plan.setIssueType}` : `typ -> ${plan.setIssueType}`);
  }
  if (plan.setPriority) {
    parts.push(`Priority -> ${plan.setPriority}`);
  }
  if (plan.removeLabels.length) {
    parts.push(`usuwam etykiety: ${plan.removeLabels.join(", ")}`);
  }
  return parts.join("; ");
}

export function formatPrMigrationSummary(plan) {
  if (!plan.removeLabels.length) return "";
  return `usuwam etykiety: ${plan.removeLabels.join(", ")}`;
}
