"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Honeypot, Input, Select, Textarea } from "@/components/ui/Field";
import { inspectionSchema } from "@/lib/validation";
import { useSubmit } from "@/lib/client/use-submit";

export function InspectionForm({ terminals, containerSlug }: { terminals: string[]; containerSlug?: string }) {
  const { status, errors, submit, reset } = useSubmit(inspectionSchema, "/api/inspection");
  const today = new Date();
  const min = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
  const max = new Date(today.getTime() + 89 * 86_400_000).toISOString().slice(0, 10);

  return (
    <AnimatePresence mode="wait">
      {status === "success" ? (
        <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-16 text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }}>
            <CheckCircle2 className="size-16 text-success-600" />
          </motion.span>
          <h3 className="font-display text-2xl font-bold">Inspection requested</h3>
          <p className="max-w-sm text-ink-500">We&apos;ll call you to confirm the time. Bring a valid ID to the terminal.</p>
          <Button variant="secondary" onClick={reset}>Book another</Button>
        </motion.div>
      ) : (
        <motion.form key="f" noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="relative grid gap-5 sm:grid-cols-2">
          <Honeypot />
          <input type="hidden" name="containerSlug" value={containerSlug ?? ""} />
          <Input name="fullName" label="Full name" required autoComplete="name" error={errors.fullName} />
          <Input name="phone" type="tel" label="Phone" required autoComplete="tel" error={errors.phone} />
          <Input name="email" type="email" label="Email" required autoComplete="email" className="sm:col-span-2" error={errors.email} />
          <Select name="terminal" label="Terminal" required defaultValue="" error={errors.terminal}>
            <option value="" disabled>Select terminal…</option>
            {terminals.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input name="preferredDate" type="date" label="Preferred date" required min={min} max={max} error={errors.preferredDate} />
          <Textarea name="notes" label="Notes (optional)" rows={3} className="sm:col-span-2" maxLength={1000} error={errors.notes} placeholder={containerSlug ? `Interested in: ${containerSlug}` : "Which container(s) would you like to see?"} />
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" loading={status === "submitting"} icon={<CalendarCheck className="size-4" />}>Request inspection</Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
