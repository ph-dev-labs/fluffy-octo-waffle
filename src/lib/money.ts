// All amounts are integer kobo (1 NGN = 100 kobo). Never use floats for money.

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(kobo: number): string {
  return ngn.format(Math.round(kobo / 100));
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}
