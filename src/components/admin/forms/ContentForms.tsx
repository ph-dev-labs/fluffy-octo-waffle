"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveGalleryItemAction, saveTestimonialAction, saveZoneAction } from "@/app/admin/actions/content";
import { createAdminAction, resetAdminPasswordAction } from "@/app/admin/actions/users";
import { initialState, type ActionState } from "@/app/admin/actions/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { MediaUploader } from "../MediaUploader";
import { FormMessage, SubmitButton } from "../ui";
import { cn } from "@/lib/utils";

/** Clears a "create" form after a successful submit. */
function useResetOnSuccess(state: ActionState, enabled: boolean) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (enabled && state.ok) ref.current?.reset();
  }, [state, enabled]);
  return ref;
}

const Check = ({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) => (
  <label className="flex h-12 items-center gap-2 text-sm">
    <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-brand-600" /> {label}
  </label>
);

// ── Delivery zone ──────────────────────────────────────────────────────────

export interface ZoneValues {
  id: string;
  code: string;
  label: string;
  perContainerKobo: number;
  sortOrder: number;
  active: boolean;
}

export function ZoneForm({ zone }: { zone?: ZoneValues }) {
  const [state, action] = useActionState(saveZoneAction.bind(null, zone?.id ?? null), initialState);
  const ref = useResetOnSuccess(state, !zone);
  const f = state.fields ?? {};
  return (
    <form ref={ref} action={action} className={cn("grid items-start gap-3 sm:grid-cols-[150px_1fr_160px_80px_auto_auto]", zone && "border-t border-ink-100 pt-4 first:border-0 first:pt-0")}>
      <Input name="code" label="Code" required defaultValue={zone?.code} readOnly={!!zone} error={f.code} placeholder="LAGOS" />
      <Input name="label" label="Region label" required defaultValue={zone?.label} error={f.label} placeholder="Lagos (within state)" />
      <Input name="rateNaira" type="number" min={0} step="1" label="₦ per container" required defaultValue={zone ? zone.perContainerKobo / 100 : undefined} error={f.rateNaira} />
      <Input name="sortOrder" type="number" min={0} label="Order" defaultValue={zone?.sortOrder ?? 0} error={f.sortOrder} />
      <div className="pt-6"><Check name="active" label="Active" defaultChecked={zone?.active ?? true} /></div>
      <div className="pt-7"><SubmitButton variant={zone ? "secondary" : "primary"} pendingText="…">{zone ? "Save" : "Add"}</SubmitButton></div>
      <div className="sm:col-span-6"><FormMessage state={state} /></div>
    </form>
  );
}

// ── Gallery ────────────────────────────────────────────────────────────────

export function GalleryItemForm({ item }: { item?: { id: string; url: string; caption: string; sortOrder: number; active: boolean } }) {
  const [state, action] = useActionState(saveGalleryItemAction.bind(null, item?.id ?? null), initialState);
  const f = state.fields ?? {};
  // Remount the uploader after a successful create so it clears.
  return (
    <form key={!item && state.ok ? JSON.stringify(state) : "form"} action={action} className="space-y-4">
      <MediaUploader name="url" folder="gallery" single allowVideo initial={item ? [item.url] : []} />
      {f.url ? <p className="text-xs font-medium text-danger-600">{f.url}</p> : null}
      <Input name="caption" label="Caption" required defaultValue={item?.caption} maxLength={160} error={f.caption} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="sortOrder" type="number" min={0} label="Order" defaultValue={item?.sortOrder ?? 0} />
        <div className="pt-6"><Check name="active" label="Visible" defaultChecked={item?.active ?? true} /></div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{item ? "Save" : "Add to gallery"}</SubmitButton>
    </form>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────

export function TestimonialForm({ t }: { t?: { id: string; quote: string; name: string; role: string; sortOrder: number; active: boolean } }) {
  const [state, action] = useActionState(saveTestimonialAction.bind(null, t?.id ?? null), initialState);
  const ref = useResetOnSuccess(state, !t);
  const f = state.fields ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Textarea name="quote" label="Quote" required rows={3} defaultValue={t?.quote} maxLength={600} error={f.quote} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Name" required defaultValue={t?.name} error={f.name} />
        <Input name="role" label="Role · company" required defaultValue={t?.role} error={f.role} />
      </div>
      <div className="grid grid-cols-[100px_1fr_auto] items-start gap-3">
        <Input name="sortOrder" type="number" min={0} label="Order" defaultValue={t?.sortOrder ?? 0} />
        <div className="pt-6"><Check name="active" label="Show on site" defaultChecked={t?.active ?? true} /></div>
        <div className="pt-7"><SubmitButton variant={t ? "secondary" : "primary"} pendingText="…">{t ? "Save" : "Add"}</SubmitButton></div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

// ── Admin users ────────────────────────────────────────────────────────────

export function CreateAdminForm() {
  const [state, action] = useActionState(createAdminAction, initialState);
  const ref = useResetOnSuccess(state, true);
  const f = state.fields ?? {};
  return (
    <div className="space-y-4">
      <form ref={ref} action={action} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
        <Input name="name" label="Name" required error={f.name} />
        <Input name="email" type="email" label="Email" required error={f.email} />
        <Select name="role" label="Role" defaultValue="ADMIN">
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </Select>
        <div className="pt-7"><SubmitButton pendingText="Creating…">Create</SubmitButton></div>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

export function ResetPasswordButton({ id }: { id: string }) {
  const [state, action] = useActionState(resetAdminPasswordAction.bind(null, id), initialState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Generate a new temporary password? Their current sessions will be signed out.")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <SubmitButton variant="secondary" pendingText="…">Reset password</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
