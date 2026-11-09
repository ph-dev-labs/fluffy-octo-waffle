// All amounts are integer minor units (100 = 1 NGN or 1 USD). Never use floats for money.

export const INVOICE_CURRENCIES = ["NGN", "USD"] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

const formatter = (currency: InvoiceCurrency) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(kobo: number, currency: InvoiceCurrency = "NGN"): string {
  const value = Math.round(kobo / 100);
  return formatter(currency).format(value);
}

export function formatNaira(kobo: number): string {
  return formatMoney(kobo, "NGN");
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function amountToMinorUnits(value: number, currency: InvoiceCurrency): number {
  return Math.round(value * 100);
}
