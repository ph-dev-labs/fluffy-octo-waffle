"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { destroyMedia, isAllowedMediaUrl } from "@/lib/cloudinary";
import { parseImages } from "@/lib/utils";
import type { ActionState } from "./types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const schema = z.object({
  title: z.string().trim().min(3, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes only"),
  summary: z.string().trim().min(5, "Add a short summary").max(200),
  description: z.string().trim().min(10, "Add a description").max(5000),
  size: z.enum(["20FT", "40FT", "40HC", "45HC"]),
  type: z.enum(["DRY", "REEFER", "OPEN_TOP", "FLAT_RACK"]),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]),
  terminal: z.string().trim().min(2, "Terminal is required").max(120),
  priceNaira: z.coerce.number("Enter a price").positive("Price must be greater than 0").max(1_000_000_000),
  stock: z.coerce.number().int().min(0).max(10_000),
  featured: z.literal("on").optional(),
  active: z.literal("on").optional(),
  images: z
    .string()
    .transform((v, ctx) => {
      try {
        const arr = JSON.parse(v || "[]");
        if (!Array.isArray(arr) || arr.some((x) => typeof x !== "string")) throw new Error();
        return arr as string[];
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid image list" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.string()).max(12, "Maximum 12 photos").refine((a) => a.every(isAllowedMediaUrl), "One or more images are from an unapproved source")),
});

function toData(v: z.infer<typeof schema>) {
  return {
    title: v.title,
    slug: v.slug || slugify(v.title),
    summary: v.summary,
    description: v.description,
    size: v.size,
    type: v.type,
    condition: v.condition,
    terminal: v.terminal,
    priceKobo: Math.round(v.priceNaira * 100),
    stock: v.stock,
    featured: v.featured === "on",
    active: v.active === "on",
    images: JSON.stringify(v.images),
  };
}

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));

function revalidateStore(slug?: string) {
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/containers/${slug}`);
}

export async function saveContainerAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const data = toData(parsed.data);

  try {
    if (id) {
      const before = await db.container.findUniqueOrThrow({ where: { id } });
      await db.container.update({ where: { id }, data });
      const removed = parseImages(before.images).filter((u) => !parsed.data.images.includes(u));
      await Promise.all(removed.map(destroyMedia));
      await audit(admin.id, "container.update", id, `${data.title} · price ${before.priceKobo}→${data.priceKobo} · stock ${before.stock}→${data.stock}`);
      revalidateStore(data.slug);
      return { ok: true, message: "Container saved." };
    }
    const created = await db.container.create({ data });
    await audit(admin.id, "container.create", created.id, data.title);
    revalidateStore(created.slug);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { message: "That URL slug is already used by another container.", fields: { slug: "Already in use" } };
    throw err;
  }
  redirect("/admin/containers?created=1");
}

export async function toggleContainerAction(id: string, field: "active" | "featured") {
  const admin = await requireAdmin();
  const c = await db.container.findUniqueOrThrow({ where: { id } });
  await db.container.update({ where: { id }, data: { [field]: !c[field] } });
  await audit(admin.id, `container.${field}`, id, `${c.title}: ${!c[field]}`);
  revalidateStore(c.slug);
}

export async function deleteContainerAction(id: string): Promise<void> {
  const admin = await requireAdmin();
  const c = await db.container.findUniqueOrThrow({ where: { id }, include: { _count: { select: { orderItems: true } } } });
  if (c._count.orderItems > 0) {
    // Keep order history intact: hide instead of deleting.
    await db.container.update({ where: { id }, data: { active: false } });
    await audit(admin.id, "container.archive", id, `${c.title} (has orders — archived instead of deleted)`);
  } else {
    await db.container.delete({ where: { id } });
    await Promise.all(parseImages(c.images).map(destroyMedia));
    await audit(admin.id, "container.delete", id, c.title);
  }
  revalidateStore(c.slug);
  redirect("/admin/containers");
}
