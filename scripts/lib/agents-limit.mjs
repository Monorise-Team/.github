/**
 * Kontrola rozmiaru pliku AGENTS.md w bajtach UTF-8 (limit Antigravity).
 */

export const AGENTS_WARN_BYTES = 20000;
export const AGENTS_MAX_BYTES = 24000;

export function checkAgentsSize(text, filePath = "AGENTS.md") {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > AGENTS_MAX_BYTES) {
    return {
      status: "error",
      bytes,
      limit: AGENTS_MAX_BYTES,
      message: `BŁĄD: ${filePath} ma ${bytes} bajtów UTF-8 (limit ${AGENTS_MAX_BYTES} dla Antigravity). Przenieś szczegóły repozytorium do docs/agents/*.md i zostaw w AGENTS.md zasady oraz linki.`,
    };
  }
  if (bytes > AGENTS_WARN_BYTES) {
    return {
      status: "warn",
      bytes,
      limit: AGENTS_WARN_BYTES,
      message: `UWAGA: ${filePath} ma ${bytes} bajtów UTF-8 (ostrzeżenie powyżej ${AGENTS_WARN_BYTES}, limit ${AGENTS_MAX_BYTES} dla Antigravity). Przenieś szczegóły repozytorium do docs/agents/*.md i zostaw w AGENTS.md zasady oraz linki.`,
    };
  }
  return {
    status: "ok",
    bytes,
    limit: AGENTS_MAX_BYTES,
    message: null,
  };
}
