"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";
import { toast } from "sonner";
import { ApiError, fetchJson, NetworkError } from "./fetch-json";
import { fieldErrors } from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Shared submit logic for the public forms: client-side Zod validation for
 * instant feedback, then a POST with timeout + retry on transient errors,
 * server field errors mapped back to inputs, and friendly toasts.
 */
export function useSubmit<S extends z.ZodType>(schema: S, url: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = useCallback(
    async (form: HTMLFormElement, extra: Record<string, unknown> = {}) => {
      const raw = { ...Object.fromEntries(new FormData(form).entries()), ...extra };
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        setStatus("error");
        form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
        return false;
      }
      setErrors({});
      setStatus("submitting");
      try {
        await fetchJson(url, { method: "POST", json: raw, retries: 2 });
        setStatus("success");
        form.reset();
        return true;
      } catch (err) {
        setStatus("error");
        if (err instanceof ApiError && err.fields) setErrors(err.fields);
        toast.error(err instanceof ApiError || err instanceof NetworkError ? err.message : "Something went wrong. Please try again.");
        return false;
      }
    },
    [schema, url],
  );

  return { status, errors, submit, reset: () => setStatus("idle") };
}
