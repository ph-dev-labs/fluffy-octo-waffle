import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_[A-Za-z0-9]+$/, "PAYSTACK_SECRET_KEY must look like sk_test_... or sk_live_...")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  PAYSTACK_WEBHOOK_IPS: z.string().optional(),
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET must be at least 32 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parsed lazily so `next build` doesn't require runtime secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
    console.warn("[env] Running in production with a Paystack TEST key.");
  }
  cached = parsed.data;
  return cached;
}
