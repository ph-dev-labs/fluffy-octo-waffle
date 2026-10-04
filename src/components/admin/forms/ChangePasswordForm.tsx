"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/admin/actions/auth";
import { initialState } from "@/app/admin/actions/types";
import { Input } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "../ui";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);
  return (
    <form action={action} className="space-y-4">
      <Input name="current" type="password" label="Current password" required autoComplete="current-password" error={state.fields?.current} />
      <Input name="password" type="password" label="New password" required autoComplete="new-password" hint="At least 12 characters, including a letter and a number." error={state.fields?.password} />
      <Input name="confirm" type="password" label="Confirm new password" required autoComplete="new-password" error={state.fields?.confirm} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Update password</SubmitButton>
    </form>
  );
}
