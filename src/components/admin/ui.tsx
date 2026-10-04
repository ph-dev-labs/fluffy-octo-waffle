"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/app/admin/actions/types";

export function SubmitButton({ children, variant = "primary", className, pendingText }: { children: ReactNode; variant?: "primary" | "danger" | "secondary"; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        variant === "primary" && "bg-ink-900 text-white hover:bg-brand-600",
        variant === "danger" && "bg-danger-600 text-white hover:bg-danger-600/90",
        variant === "secondary" && "bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50",
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Inline result banner for useActionState forms; also toasts success. */
export function FormMessage({ state }: { state: ActionState }) {
  const last = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok && state.message && !state.secret) toast.success(state.message);
  }, [state]);

  return (
    <AnimatePresence>
      {state.secret ? (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-warning-100 p-4 text-sm text-ink-900">
          <p className="font-semibold">{state.message}</p>
          <p className="mt-1 text-xs text-ink-500">Copy it now — it will not be shown again. Share it privately (not by email).</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm break-all">{state.secret}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(state.secret!).then(() => toast.success("Copied"))} className="grid size-9 place-items-center rounded-lg bg-white hover:bg-ink-100" aria-label="Copy">
              <Copy className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : state.message && !state.ok ? (
        <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-xl bg-danger-100 p-3 text-sm text-danger-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {state.message}
        </motion.p>
      ) : state.ok && state.message ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-success-600">
          <CheckCircle2 className="size-4" /> {state.message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-white p-5 ring-1 ring-ink-900/5 sm:p-6", className)}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="font-display text-base font-bold">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Button that asks for confirmation before submitting its parent form. */
export function ConfirmSubmit({ children, message, variant = "danger" }: { children: ReactNode; message: string; variant?: "danger" | "secondary" | "primary" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium disabled:opacity-50",
        variant === "danger" ? "text-danger-600 hover:bg-danger-100" : variant === "primary" ? "bg-ink-900 text-white hover:bg-brand-600" : "text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
