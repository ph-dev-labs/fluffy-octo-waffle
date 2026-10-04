import { cn } from "@/lib/utils";

const TONES = {
  green: "bg-success-100 text-success-600",
  amber: "bg-warning-100 text-warning-600",
  red: "bg-danger-100 text-danger-600",
  blue: "bg-brand-100 text-brand-700",
  grey: "bg-ink-100 text-ink-600",
} as const;

export function Badge({ tone = "grey", children, className }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

const PAYMENT: Record<string, keyof typeof TONES> = { PAID: "green", PENDING: "amber", FAILED: "red", ABANDONED: "grey", AMOUNT_MISMATCH: "red", REFUNDED: "blue" };
export const PaymentBadge = ({ status }: { status: string }) => <Badge tone={PAYMENT[status] ?? "grey"}>{status.replace("_", " ").toLowerCase()}</Badge>;

const FULFIL: Record<string, keyof typeof TONES> = { UNFULFILLED: "amber", PROCESSING: "blue", DISPATCHED: "blue", DELIVERED: "green", COLLECTED: "green", CANCELLED: "grey" };
export const FulfilmentBadge = ({ status }: { status: string }) => <Badge tone={FULFIL[status] ?? "grey"}>{status.toLowerCase()}</Badge>;

export const FULFILMENT_STATUSES = ["UNFULFILLED", "PROCESSING", "DISPATCHED", "DELIVERED", "COLLECTED", "CANCELLED"] as const;
