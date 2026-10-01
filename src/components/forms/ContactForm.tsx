"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Honeypot, Input, Textarea } from "@/components/ui/Field";
import { contactSchema } from "@/lib/validation";
import { useSubmit } from "@/lib/client/use-submit";

export function ContactForm() {
  const { status, errors, submit, reset } = useSubmit(contactSchema, "/api/contact");
  return (
    <AnimatePresence mode="wait">
      {status === "success" ? (
        <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="size-16 text-success-600" />
          <h3 className="font-display text-2xl font-bold">Message sent</h3>
          <p className="text-ink-500">We&apos;ll get back to you shortly.</p>
          <Button variant="secondary" onClick={reset}>Send another</Button>
        </motion.div>
      ) : (
        <motion.form key="f" noValidate onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="relative grid gap-5 sm:grid-cols-2">
          <Honeypot />
          <Input name="fullName" label="Full name" required autoComplete="name" error={errors.fullName} />
          <Input name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
          <Input name="subject" label="Subject" required className="sm:col-span-2" error={errors.subject} />
          <Textarea name="message" label="Message" required rows={5} className="sm:col-span-2" maxLength={4000} error={errors.message} />
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" loading={status === "submitting"} icon={<Send className="size-4" />}>Send message</Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
