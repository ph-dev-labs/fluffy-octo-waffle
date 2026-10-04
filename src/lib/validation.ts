// Shared Zod schemas: used by the API routes (authoritative) and by forms on
// the client (for instant feedback). Client validation is UX only.
import { z } from "zod";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

// Accepts Nigerian (+234 / 0...) and international numbers.
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"));

/** Honeypot: real users never see or fill this field. */
const honeypot = z.string().max(0).optional().or(z.literal(""));

export const cartLineSchema = z.object({
  containerId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(50),
});

export const cartPriceSchema = z.object({
  items: z.array(cartLineSchema).min(1).max(20),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.uuid(),
    items: z.array(cartLineSchema).min(1, "Your cart is empty").max(20),
    customer: z.object({
      fullName: trimmed(2, 120, "Full name"),
      email,
      phone,
      companyName: z.string().trim().max(160).optional().or(z.literal("")),
    }),
    fulfilment: z.enum(["PICKUP", "DELIVERY"]),
    deliveryZone: z.string().regex(/^[A-Z0-9_]{2,32}$/, "Choose a delivery region").optional(),
    deliveryAddress: z.string().trim().max(500).optional().or(z.literal("")),
    website: honeypot,
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment !== "DELIVERY") return;
    if (!v.deliveryZone) ctx.addIssue({ code: "custom", path: ["deliveryZone"], message: "Choose a delivery region" });
    if (!v.deliveryAddress || v.deliveryAddress.length < 10)
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Enter a full delivery address" });
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const referenceSchema = z.string().regex(/^CZ_[A-Z0-9_]{8,48}$/, "Invalid payment reference");

export const quoteSchema = z.object({
  companyName: trimmed(2, 160, "Company name"),
  email,
  phone,
  size: z.enum(["20FT", "40FT", "40HC", "45HC", ""]).optional(),
  quantity: z.enum(["1", "2", "3", "4", "5", "6+"], "Select a quantity"),
  condition: z.enum(["NEW", "USED"], "Select new or used"),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  website: honeypot,
});

export const inspectionSchema = z.object({
  fullName: trimmed(2, 120, "Full name"),
  email,
  phone,
  terminal: trimmed(2, 120, "Terminal"),
  preferredDate: z.coerce
    .date("Pick a date")
    .refine((d) => d.getTime() > Date.now() - 86_400_000, "Date must be in the future")
    .refine((d) => d.getTime() < Date.now() + 90 * 86_400_000, "Pick a date within the next 90 days"),
  containerSlug: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  website: honeypot,
});

export const contactSchema = z.object({
  fullName: trimmed(2, 120, "Full name"),
  email,
  subject: trimmed(2, 160, "Subject"),
  message: trimmed(10, 4000, "Message"),
  website: honeypot,
});

/** Flattens Zod issues into { "customer.email": "message" } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
