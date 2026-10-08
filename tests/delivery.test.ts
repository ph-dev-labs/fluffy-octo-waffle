import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryTotalKobo, distanceFeeKobo, feesBySize, haversineKm, inNigeria, nearestYardEstimate } from "../src/lib/delivery/calc";
import { signQuote, verifyQuote } from "../src/lib/delivery/quote-token";
import { stateKey } from "../src/lib/delivery/geo";

// env() is read lazily, so setting these before the first call is enough.
process.env.DATABASE_URL ??= "postgresql://test@localhost/test";
process.env.APP_URL ??= "http://localhost:3000";
process.env.QUOTE_SIGNING_SECRET = "test-secret-for-delivery-quotes-0123456789";


const rules = { baseFeeKobo: 150_000_00, ratePerKmKobo: 700_00, minFeeKobo: 150_000_00, maxFeeKobo: 1_500_000_00 };

test("haversine: Lagos (Apapa) → Abuja is ~520 km in a straight line", () => {
  const km = haversineKm(6.4474, 3.364, 9.0765, 7.3986);
  assert.ok(km > 500 && km < 540, String(km));
});

test("distance fee = base + km × rate, rounded to ₦1,000", () => {
  assert.equal(distanceFeeKobo(100, rules), 220_000_00);
  assert.equal(distanceFeeKobo(38.6, rules), 177_000_00); // 150,000 + 27,020 → 177,000
});

test("distance fee is clamped to min and max", () => {
  assert.equal(distanceFeeKobo(0, { ...rules, baseFeeKobo: 10_000_00 }), 150_000_00);
  assert.equal(distanceFeeKobo(5000, rules), 1_500_000_00);
});

test("size multipliers scale the 20ft price; unknown sizes count as 100%", () => {
  const per = feesBySize(200_000_00, { "20FT": 100, "40FT": 150 });
  assert.equal(per["20FT"], 200_000_00);
  assert.equal(per["40FT"], 300_000_00);
  assert.equal(per["45HC"], 200_000_00);
  assert.equal(deliveryTotalKobo(per, [{ size: "20FT", quantity: 2 }, { size: "40FT", quantity: 1 }], 0), 700_000_00);
});

test("nearest yard wins and the road factor is applied", () => {
  const yards = [{ name: "Apapa", lat: 6.4474, lng: 3.364 }, { name: "Onne", lat: 4.7238, lng: 7.1517 }];
  const ph = nearestYardEstimate(yards, 4.8156, 7.0498, 135)!; // Port Harcourt
  assert.equal(ph.yard.name, "Onne");
  const straight = haversineKm(4.7238, 7.1517, 4.8156, 7.0498);
  assert.ok(Math.abs(ph.km - straight * 1.35) < 1e-9);
});

test("pins outside Nigeria are rejected", () => {
  assert.equal(inNigeria(6.5, 3.4), true);
  assert.equal(inNigeria(6.37, 2.39), false); // Cotonou
  assert.equal(inNigeria(51.5, -0.12), false);
});

test("OSM state names match our state labels", () => {
  assert.equal(stateKey("Lagos State"), stateKey("Lagos"));
  assert.equal(stateKey("Federal Capital Territory"), stateKey("FCT (Abuja)"));
  assert.equal(stateKey("Akwa Ibom State"), stateKey("Akwa Ibom"));
  assert.equal(stateKey("Cross River State"), stateKey("Cross River"));
  assert.equal(stateKey("Nassarawa State"), stateKey("Nasarawa"));
  assert.notEqual(stateKey("Ogun State"), stateKey("Lagos"));
});

const sample = { stateCode: "LAGOS", stateLabel: "Lagos", areaCode: "LAGOS_LEKKI", areaLabel: "Lekki", lat: 6.44, lng: 3.47, method: "AREA" as const, distanceKm: null, yard: null, perSize: { "20FT": 220_000_00 } };

test("signed quote round-trips", () => {
  const { token } = signQuote(sample);
  const v = verifyQuote(token);
  assert.equal(v.ok, true);
  assert.equal(v.ok && v.quote.perSize["20FT"], 220_000_00);
});

test("a tampered quote is rejected (customer can't lower the fee)", () => {
  const { token } = signQuote(sample);
  const [body, sig] = token.split(".");
  const q = JSON.parse(Buffer.from(body!, "base64url").toString());
  q.perSize["20FT"] = 1_00;
  const forged = `${Buffer.from(JSON.stringify(q)).toString("base64url")}.${sig}`;
  assert.deepEqual(verifyQuote(forged), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyQuote("garbage"), { ok: false, reason: "invalid" });
});

test("an expired quote is rejected", (t) => {
  const { token } = signQuote(sample);
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 46 * 60_000 });
  assert.deepEqual(verifyQuote(token), { ok: false, reason: "expired" });
  t.mock.timers.reset();
});
