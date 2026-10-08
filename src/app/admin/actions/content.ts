"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { destroyMedia, isAllowedMediaUrl } from "@/lib/cloudinary";
import type { ActionState } from "./types";

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
const checkbox = z.literal("on").optional().transform((v) => v === "on");

// ── Requests (quotes / inspections / messages) ───────────────────────────

const REQUEST_KINDS = ["quote", "inspection", "message"] as const;
type RequestKind = (typeof REQUEST_KINDS)[number];

async function updateRequest(kind: RequestKind, id: string, data: { status: string }) {
  if (kind === "quote") return db.quoteRequest.update({ where: { id }, data });
  if (kind === "inspection") return db.inspectionRequest.update({ where: { id }, data });
  return db.contactMessage.update({ where: { id }, data });
}

async function deleteRequest(kind: RequestKind, id: string) {
  if (kind === "quote") return db.quoteRequest.delete({ where: { id } });
  if (kind === "inspection") return db.inspectionRequest.delete({ where: { id } });
  return db.contactMessage.delete({ where: { id } });
}

export async function setRequestStatusAction(kind: RequestKind, id: string, status: "NEW" | "HANDLED") {
  const admin = await requireAdmin();
  if (!REQUEST_KINDS.includes(kind) || !["NEW", "HANDLED"].includes(status)) return;
  await updateRequest(kind, id, { status });
  await audit(admin.id, `request.${status.toLowerCase()}`, id, kind);
  revalidatePath("/admin", "layout");
}

export async function deleteRequestAction(kind: RequestKind, id: string) {
  const admin = await requireAdmin();
  if (!REQUEST_KINDS.includes(kind)) return;
  await deleteRequest(kind, id);
  await audit(admin.id, "request.delete", id, kind);
  revalidatePath("/admin", "layout");
}

// ── Gallery ──────────────────────────────────────────────────────────────

const gallerySchema = z.object({
  url: z.string().refine(isAllowedMediaUrl, "Upload a photo or video first"),
  caption: z.string().trim().min(2, "Add a caption").max(160),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
});

export async function saveGalleryItemAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = gallerySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const type = /\/video\/upload\/|\.(mp4|mov|webm)$/i.test(parsed.data.url) ? "video" : "image";
  if (id) {
    const before = await db.galleryItem.findUniqueOrThrow({ where: { id } });
    await db.galleryItem.update({ where: { id }, data: { ...parsed.data, type } });
    if (before.url !== parsed.data.url) await destroyMedia(before.url);
    await audit(admin.id, "gallery.update", id, parsed.data.caption);
  } else {
    const created = await db.galleryItem.create({ data: { ...parsed.data, type } });
    await audit(admin.id, "gallery.create", created.id, parsed.data.caption);
  }
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/");
  return { ok: true, message: id ? "Saved." : "Added to gallery." };
}

export async function deleteGalleryItemAction(id: string) {
  const admin = await requireAdmin();
  const item = await db.galleryItem.delete({ where: { id } });
  await destroyMedia(item.url);
  await audit(admin.id, "gallery.delete", id, item.caption);
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  revalidatePath("/");
}

// ── Testimonials ─────────────────────────────────────────────────────────

const testimonialSchema = z.object({
  quote: z.string().trim().min(10, "Quote is too short").max(600),
  name: z.string().trim().min(2, "Name is required").max(80),
  role: z.string().trim().min(2, "Role / company is required").max(120),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
});

export async function saveTestimonialAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = testimonialSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  if (id) await db.testimonial.update({ where: { id }, data: parsed.data });
  else await db.testimonial.create({ data: parsed.data });
  await audit(admin.id, id ? "testimonial.update" : "testimonial.create", id, parsed.data.name);
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true, message: id ? "Saved." : "Testimonial added." };
}

export async function deleteTestimonialAction(id: string) {
  const admin = await requireAdmin();
  const t = await db.testimonial.delete({ where: { id } });
  await audit(admin.id, "testimonial.delete", id, t.name);
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
}
