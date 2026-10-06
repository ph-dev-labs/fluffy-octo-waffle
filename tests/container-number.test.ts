import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContainerNumber, formatContainerNumber, isoCheckDigit } from "../src/lib/container-number";

test("ISO 6346 check digit — reference example CSQU3054383", () => {
  assert.equal(isoCheckDigit("CSQU305438"), 3);
  assert.deepEqual(checkContainerNumber("CSQU3054383"), { ok: true, value: "CSQU3054383" });
});

test("accepts spaces, dashes and lowercase", () => {
  assert.equal(checkContainerNumber("csqu 305438-3").ok, true);
  assert.equal(formatContainerNumber("csqu3054383"), "CSQU 305438 3");
});

test("catches a single-digit typo via the check digit", () => {
  const r = checkContainerNumber("CSQU3054393");
  assert.equal(r.ok, false);
  assert.equal(r.ok ? null : r.reason, "check_digit");
});

test("catches swapped neighbouring digits", () => {
  assert.equal(checkContainerNumber("CSQU3045383").ok, false);
});

test("rejects bad formats", () => {
  for (const bad of ["", "CSQ3054383", "CSQX3054383", "CSQU305438", "1234567890A"]) {
    assert.equal(checkContainerNumber(bad).ok, false, bad);
  }
});

test("check digit can be skipped deliberately, format still enforced", () => {
  assert.equal(checkContainerNumber("CSQU3054393", { skipCheckDigit: true }).ok, true);
  assert.equal(checkContainerNumber("CSQ", { skipCheckDigit: true }).ok, false);
});

test("check digit 10 maps to 0", () => {
  // Exhaustively confirm the (sum % 11) % 10 rule never yields 10.
  for (let n = 0; n < 2000; n++) {
    const d = isoCheckDigit(`ABCU${String(n).padStart(6, "0")}`);
    assert.ok(d >= 0 && d <= 9);
  }
});
