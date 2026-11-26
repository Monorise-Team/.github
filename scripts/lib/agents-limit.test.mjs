import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENTS_MAX_BYTES, AGENTS_WARN_BYTES, checkAgentsSize } from "./agents-limit.mjs";

describe("checkAgentsSize", () => {
  it("returns ok up to and including AGENTS_WARN_BYTES", () => {
    const exactWarn = "a".repeat(AGENTS_WARN_BYTES);
    const result = checkAgentsSize(exactWarn, "AGENTS.md");
    assert.equal(result.status, "ok");
    assert.equal(result.bytes, AGENTS_WARN_BYTES);
    assert.equal(result.message, null);
  });

  it("returns warn above AGENTS_WARN_BYTES up to and including AGENTS_MAX_BYTES", () => {
    const justOverWarn = "a".repeat(AGENTS_WARN_BYTES + 1);
    const warnResult = checkAgentsSize(justOverWarn, "repo/AGENTS.md");
    assert.equal(warnResult.status, "warn");
    assert.equal(warnResult.bytes, AGENTS_WARN_BYTES + 1);
    assert.match(warnResult.message, /UWAGA: repo\/AGENTS\.md ma 20001 bajtów UTF-8/);
    assert.match(warnResult.message, /docs\/agents\/\*\.md/);

    const exactMax = "a".repeat(AGENTS_MAX_BYTES);
    const boundaryResult = checkAgentsSize(exactMax, "AGENTS.md");
    assert.equal(boundaryResult.status, "warn");
    assert.equal(boundaryResult.bytes, AGENTS_MAX_BYTES);
  });

  it("returns error above AGENTS_MAX_BYTES", () => {
    const justOverMax = "a".repeat(AGENTS_MAX_BYTES + 1);
    const result = checkAgentsSize(justOverMax, "repo/AGENTS.md");
    assert.equal(result.status, "error");
    assert.equal(result.bytes, AGENTS_MAX_BYTES + 1);
    assert.match(result.message, /BŁĄD: repo\/AGENTS\.md ma 24001 bajtów UTF-8/);
    assert.match(result.message, /docs\/agents\/\*\.md/);
  });

  it("measures UTF-8 bytes rather than JS string length for Polish text", () => {
    // "zażółć gęślą jaźń " = 18 znaków, 27 bajtów UTF-8 (9 polskich znaków po 2 bajty).
    const chunk = "zażółć gęślą jaźń ";
    assert.equal(chunk.length, 18);
    assert.equal(Buffer.byteLength(chunk, "utf8"), 27);

    // 741 * 27 = 20007 bajtów (> 20000), ale tylko 741 * 18 = 13338 znaków (< 20000).
    const warnPolish = chunk.repeat(741);
    assert.ok(warnPolish.length < AGENTS_WARN_BYTES);
    const warnResult = checkAgentsSize(warnPolish, "AGENTS.md");
    assert.equal(warnResult.status, "warn");
    assert.equal(warnResult.bytes, 20007);

    // 889 * 27 = 24003 bajty (> 24000), ale tylko 889 * 18 = 16002 znaki (< 20000).
    const errorPolish = chunk.repeat(889);
    assert.ok(errorPolish.length < AGENTS_WARN_BYTES);
    const errorResult = checkAgentsSize(errorPolish, "AGENTS.md");
    assert.equal(errorResult.status, "error");
    assert.equal(errorResult.bytes, 24003);
  });
});
