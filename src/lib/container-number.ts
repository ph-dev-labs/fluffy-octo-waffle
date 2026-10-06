// ISO 6346 shipping-container numbers, e.g. "CSQU 305438 3":
//   3-letter owner code + equipment category (U freight, J detachable, Z trailer)
//   + 6-digit serial + 1 check digit.
// The check digit catches almost every single-character typo, so invoices
// don't go out with a wrong container number.

const LETTER_VALUES: Record<string, number> = (() => {
  // A=10 … Z=38, skipping multiples of 11 (11, 22, 33).
  const map: Record<string, number> = {};
  let v = 10;
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (v % 11 === 0) v++;
    map[ch] = v++;
  }
  return map;
})();

export function normalizeContainerNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isoCheckDigit(first10: string): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    const value = /[A-Z]/.test(ch) ? LETTER_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

export type ContainerNumberCheck =
  | { ok: true; value: string }
  | { ok: false; value: string; reason: "empty" | "format" | "check_digit"; message: string };

export function checkContainerNumber(raw: string, { skipCheckDigit = false } = {}): ContainerNumberCheck {
  const value = normalizeContainerNumber(raw);
  if (!value) return { ok: false, value, reason: "empty", message: "Enter the container number" };
  if (!/^[A-Z]{3}[UJZ][0-9]{7}$/.test(value)) {
    return { ok: false, value, reason: "format", message: "Use 4 letters + 7 digits, e.g. CSQU 305438 3" };
  }
  if (!skipCheckDigit) {
    const expected = isoCheckDigit(value.slice(0, 10));
    if (expected !== Number(value[10])) {
      return { ok: false, value, reason: "check_digit", message: `Check digit doesn't match (expected ${expected}) — please re-check this number` };
    }
  }
  return { ok: true, value };
}

/** "CSQU3054383" → "CSQU 305438 3" (how it's painted on the container door). */
export function formatContainerNumber(value: string): string {
  const v = normalizeContainerNumber(value);
  return v.length === 11 ? `${v.slice(0, 4)} ${v.slice(4, 10)} ${v.slice(10)}` : v;
}
