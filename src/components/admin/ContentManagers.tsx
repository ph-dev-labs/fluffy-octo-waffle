"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, EyeOff, ImageIcon, Pencil, Play, Quote, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { deleteGalleryItemAction, deleteTestimonialAction } from "@/app/admin/actions/content";
import SmartImage from "@/components/ui/SmartImage";
import { cloudinaryPoster, cloudinaryVideo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Badge } from "./badges";
import { GalleryItemForm, TestimonialForm, type GalleryItemValues, type TestimonialValues } from "./forms/ContentForms";
import { ConfirmSubmit } from "./ui";

const EASE = [0.22, 1, 0.36, 1] as const;

/** One item open for editing at a time; Escape closes it. */
function useSingleEditor() {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close]);
  return { openId, open: setOpenId, close };
}

function EditButton({ editing, onClick, label }: { editing: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={editing}
      aria-label={editing ? `Close editor for ${label}` : `Edit ${label}`}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
        editing ? "bg-ink-900 text-white hover:bg-ink-800" : "text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50",
      )}
    >
      <Pencil className="size-3.5" />
      {editing ? "Editing" : "Edit"}
    </button>
  );
}

function DeleteButton({ action, message }: { action: () => Promise<void>; message: string }) {
  return (
    <form action={action}>
      <ConfirmSubmit message={message}>
        <Trash2 className="size-4" />
        <span className="sr-only">Delete</span>
      </ConfirmSubmit>
    </form>
  );
}

// ── Gallery ────────────────────────────────────────────────────────────────

export function GalleryManager({ items }: { items: (GalleryItemValues & { type: string })[] }) {
  const { openId, open, close } = useSingleEditor();

  if (!items.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 p-12 text-center text-sm text-ink-500 sm:col-span-2">
        <ImageIcon className="size-8 text-ink-300" />
        No gallery items yet. Add the first photo or video using the panel on the right.
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((g) => {
          const editing = openId === g.id;
          return (
            <motion.article
              key={g.id}
              // "position" only: cards glide to their new spot without the
              // size interpolation that would stretch the photos mid-flight.
              layout="position"
              transition={{ layout: { duration: 0.35, ease: EASE } }}
              ref={editing ? (el: HTMLElement | null) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" }) : undefined}
              className={cn("overflow-hidden rounded-2xl bg-white ring-1 transition-shadow", editing ? "shadow-lift ring-brand-500/40 sm:col-span-2" : "ring-ink-900/5 hover:shadow-card")}
            >
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-display text-base font-bold">Edit {g.type}</h3>
                      <EditButton editing onClick={close} label={g.caption} />
                    </div>
                    <GalleryItemForm item={g} onSaved={close} onCancel={close} />
                  </motion.div>
                ) : (
                  <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className={cn("relative aspect-[4/3] bg-ink-100", !g.active && "opacity-50 grayscale")}>
                      {g.type === "video" ? (
                        <>
                          <video src={cloudinaryVideo(g.url, 640)} poster={cloudinaryPoster(g.url)} muted playsInline preload="metadata" className="size-full object-cover" />
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="grid size-12 place-items-center rounded-full bg-white/90 text-ink-900 shadow-card">
                              <Play className="size-5 fill-current" />
                            </span>
                          </span>
                        </>
                      ) : (
                        <SmartImage src={g.url} alt={g.caption} fill sizes="(min-width:1280px) 25vw, (min-width:640px) 40vw, 100vw" className="object-cover" />
                      )}
                      <span className="absolute top-3 left-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">#{g.sortOrder}</span>
                      {!g.active ? (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                          <EyeOff className="size-3" /> Hidden
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-3 p-4">
                      <p className="line-clamp-2 min-h-10 text-sm font-medium text-ink-800">{g.caption}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          <Badge tone="blue">{g.type}</Badge>
                          {g.active ? <Badge tone="green">visible</Badge> : <Badge>hidden</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <EditButton editing={false} onClick={() => open(g.id)} label={g.caption} />
                          <DeleteButton action={deleteGalleryItemAction.bind(null, g.id)} message="Delete this item (and its file on Cloudinary)?" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ── Testimonials (accordion) ───────────────────────────────────────────────

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function TestimonialManager({ items }: { items: TestimonialValues[] }) {
  const { openId, open, close } = useSingleEditor();

  if (!items.length) {
    return (
      <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 p-12 text-center text-sm text-ink-500">
        <Quote className="size-8 text-ink-300" />
        No testimonials yet. The section stays hidden on the site until you add one.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/5">
      {items.map((t) => {
        const editing = openId === t.id;
        const panelId = `testimonial-${t.id}`;
        return (
          <li key={t.id} className={cn("transition-colors", editing ? "bg-brand-50/40" : "hover:bg-ink-50/60")}>
            <div className="flex items-start gap-4 p-5">
              <span className={cn("font-display grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white", t.active ? "bg-gradient-to-br from-brand-500 to-brand-700" : "bg-ink-300")}>
                {initials(t.name)}
              </span>
              <button type="button" onClick={() => (editing ? close() : open(t.id))} aria-expanded={editing} aria-controls={panelId} className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm text-ink-500">{t.role}</span>
                  {!t.active ? <Badge>hidden</Badge> : null}
                  <span className="text-xs text-ink-400">#{t.sortOrder}</span>
                </span>
                <motion.span
                  initial={false}
                  animate={{ opacity: editing ? 0.5 : 1 }}
                  className={cn("mt-1.5 block text-sm text-ink-600 italic", editing ? "line-clamp-1" : "line-clamp-2")}
                >
                  “{t.quote}”
                </motion.span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <EditButton editing={editing} onClick={() => (editing ? close() : open(t.id))} label={t.name} />
                <DeleteButton action={deleteTestimonialAction.bind(null, t.id)} message={`Delete the testimonial from ${t.name}?`} />
                <motion.span animate={{ rotate: editing ? 180 : 0 }} className="hidden text-ink-400 sm:block" aria-hidden>
                  <ChevronDown className="size-4" />
                </motion.span>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {editing ? (
                <motion.div
                  id={panelId}
                  key="panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-ink-100 px-5 pt-4 pb-5 sm:pl-20">
                    <TestimonialForm t={t} onSaved={close} onCancel={close} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
