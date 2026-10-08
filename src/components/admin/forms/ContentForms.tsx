"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveGalleryItemAction, saveTestimonialAction } from "@/app/admin/actions/content";
import { createAdminAction, resetAdminPasswordAction } from "@/app/admin/actions/users";
import { initialState, type ActionState } from "@/app/admin/actions/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { MediaUploader } from "../MediaUploader";
import { FormMessage, SubmitButton } from "../ui";

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

// ── Gallery ────────────────────────────────────────────────────────────────

export interface GalleryItemValues {
  id: string;
  url: string;
  caption: string;
  sortOrder: number;
  active: boolean;
}

/** Calls `cb` once each time the action reports success. */
function useOnSuccess(state: ActionState, cb?: () => void) {
  const seen = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.ok && state !== seen.current) {
      seen.current = state;
      cb?.();
    }
  }, [state, cb]);
}

export function GalleryItemForm({ item, onSaved, onCancel }: { item?: GalleryItemValues; onSaved?: () => void; onCancel?: () => void }) {
  const [state, action] = useActionState(saveGalleryItemAction.bind(null, item?.id ?? null), initialState);
  useOnSuccess(state, onSaved);
  const f = state.fields ?? {};
  // Remount the uploader after a successful create so it clears.
  return (
    <form key={!item && state.ok ? JSON.stringify(state) : "form"} action={action} className="space-y-4">
      <MediaUploader name="url" folder="gallery" single allowVideo initial={item ? [item.url] : []} />
      {f.url ? <p className="text-xs font-medium text-danger-600">{f.url}</p> : null}
      <Input name="caption" label="Caption" required defaultValue={item?.caption} maxLength={160} error={f.caption} autoFocus={!!item} />
      <div className="grid grid-cols-2 gap-3">
        <Input name="sortOrder" type="number" min={0} label="Order" defaultValue={item?.sortOrder ?? 0} />
        <div className="pt-6"><Check name="active" label="Visible" defaultChecked={item?.active ?? true} /></div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">{item ? "Save changes" : "Add to gallery"}</SubmitButton>
        {onCancel ? <CancelButton onClick={onCancel} /> : null}
      </div>
    </form>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50">
      Cancel
    </button>
  );
}

// ── Testimonials ───────────────────────────────────────────────────────────

export interface TestimonialValues {
  id: string;
  quote: string;
  name: string;
  role: string;
  sortOrder: number;
  active: boolean;
}

export function TestimonialForm({ t, onSaved, onCancel }: { t?: TestimonialValues; onSaved?: () => void; onCancel?: () => void }) {
  const [state, action] = useActionState(saveTestimonialAction.bind(null, t?.id ?? null), initialState);
  const ref = useResetOnSuccess(state, !t);
  useOnSuccess(state, onSaved);
  const f = state.fields ?? {};
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Textarea name="quote" label="Quote" required rows={3} defaultValue={t?.quote} maxLength={600} error={f.quote} autoFocus={!!t} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Name" required defaultValue={t?.name} error={f.name} />
        <Input name="role" label="Role · company" required defaultValue={t?.role} error={f.role} />
      </div>
      <div className="grid grid-cols-[100px_1fr] items-start gap-3">
        <Input name="sortOrder" type="number" min={0} label="Order" defaultValue={t?.sortOrder ?? 0} />
        <div className="pt-6"><Check name="active" label="Show on site" defaultChecked={t?.active ?? true} /></div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">{t ? "Save changes" : "Add testimonial"}</SubmitButton>
        {onCancel ? <CancelButton onClick={onCancel} /> : null}
      </div>
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
