import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isValidWebhookSignature } from "../src/lib/paystack";

const KEY = "sk_test_unit_test_key";
const body = JSON.stringify({ event: "charge.success", data: { id: 1, reference: "CZ_ABC123_DEADBEEF" } });
const sign = (b: string, k = KEY) => createHmac("sha512", k).update(b).digest("hex");

test("accepts a correctly signed body", () => {
  assert.equal(isValidWebhookSignature(body, sign(body), KEY), true);
});

test("rejects a tampered body", () => {
  assert.equal(isValidWebhookSignature(body.replace("DEADBEEF", "DEADBEEE"), sign(body), KEY), false);
});

test("rejects a signature made with another key", () => {
  assert.equal(isValidWebhookSignature(body, sign(body, "sk_test_attacker"), KEY), false);
});

test("rejects missing / malformed signatures without throwing", () => {
  assert.equal(isValidWebhookSignature(body, null, KEY), false);
  assert.equal(isValidWebhookSignature(body, "", KEY), false);
  assert.equal(isValidWebhookSignature(body, "zz".repeat(64), KEY), false);
  assert.equal(isValidWebhookSignature(body, sign(body).slice(0, 100), KEY), false);
});
