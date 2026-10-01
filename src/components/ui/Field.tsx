"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "peer w-full rounded-xl border bg-white px-4 text-[15px] text-ink-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, error, hint, required, className, children }: FieldShellProps) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
        {required ? <span className="text-accent-500"> *</span> : null}
      </label>
      {children(id, describedBy)}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-400">
          {hint}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            id={errId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs font-medium text-danger-600"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type Base = { label: string; error?: string; hint?: string; className?: string };

export function Input({ label, error, hint, className, required, ...props }: Base & ComponentProps<"input">) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(control, "h-12", error ? "border-danger-600" : "border-ink-200")}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function Select({ label, error, hint, className, required, children, ...props }: Base & ComponentProps<"select">) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {(id, describedBy) => (
        <select
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(control, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%235a6688%22 stroke-width=%222%22><path d=%22M2 4l4 4 4-4%22/></svg>')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10", error ? "border-danger-600" : "border-ink-200")}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, className, required, ...props }: Base & ComponentProps<"textarea">) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          required={required}
          rows={4}
          className={cn(control, "resize-y py-3", error ? "border-danger-600" : "border-ink-200")}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/** Off-screen honeypot input. Bots fill it; humans never see it. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
