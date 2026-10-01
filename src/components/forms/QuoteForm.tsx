"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Honeypot, Input, Select, Textarea } from "@/components/ui/Field";
import { quoteSchema } from "@/lib/validation";
import { useSubmit } from "@/lib/client/use-submit";

export function QuoteForm() {
  const { status, errors, submit, reset } = useSubmit(quoteSchema, "/api/quote");

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-16 text-center">
            <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
              <CheckCircle2 className="size-16 text-success-600" />
            </motion.span>
            <h3 className="font-display text-2xl font-bold">Request received</h3>
            <p className="max-w-sm text-ink-500">Thanks! Our sales team will reach out within one business day with your quote.</p>
            <Button variant="secondary" onClick={reset}>
              Send another request
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
            className="relative grid gap-5 sm:grid-cols-2"
          >
            <Honeypot />
            <Input name="companyName" label="Company name" required autoComplete="organization" error={errors.companyName} />
            <Input name="email" type="email" label="Email address" required autoComplete="email" error={errors.email} />
            <Input name="phone" type="tel" label="Phone / mobile" required autoComplete="tel" inputMode="tel" error={errors.phone} />
            <Select name="size" label="Container size" defaultValue="" error={errors.size}>
              <option value="">Any size</option>
              <option value="20FT">20ft Standard</option>
              <option value="40FT">40ft Standard</option>
              <option value="40HC">40ft High Cube</option>
              <option value="45HC">45ft High Cube</option>
            </Select>
            <Select name="quantity" label="Number of containers" required defaultValue="" error={errors.quantity}>
              <option value="" disabled>Select…</option>
              {["1", "2", "3", "4", "5", "6+"].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            <Select name="condition" label="New or used" required defaultValue="" error={errors.condition}>
              <option value="" disabled>Select…</option>
              <option value="NEW">New</option>
              <option value="USED">Used</option>
            </Select>
            <Textarea name="message" label="Questions or remarks" className="sm:col-span-2" maxLength={2000} error={errors.message} />
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-400">We never share your details. See our privacy policy.</p>
              <Button type="submit" size="lg" loading={status === "submitting"} icon={<Send className="size-4" />}>
                Send request
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
