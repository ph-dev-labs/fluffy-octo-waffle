"use client";

import { motion } from "motion/react";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions/auth";
import { initialState } from "@/app/admin/actions/types";
import { Input, PasswordInput } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "./ui";
import { LogoMark } from "@/components/layout/Logo";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initialState);
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6 }} className="relative w-full max-w-md rounded-[2rem] bg-white p-8 shadow-lift sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <LogoMark className="h-11 w-auto" />
        <div>
          <h1 className="font-display text-xl font-bold">C-ZUCHI Admin</h1>
          <p className="text-sm text-ink-500">Sign in to manage the store</p>
        </div>
      </div>
      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={next ?? ""} />
        <Input name="email" type="email" label="Email" required autoComplete="username" autoFocus />
        <PasswordInput name="password" label="Password" required autoComplete="current-password" />
        <FormMessage state={state} />
        <SubmitButton className="h-12 w-full" pendingText="Signing in…">Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-xs text-ink-400">Accounts lock for 15 minutes after 5 failed attempts.</p>
    </motion.div>
  );
}
