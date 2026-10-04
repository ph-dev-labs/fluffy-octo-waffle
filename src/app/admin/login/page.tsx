import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-950 px-4">
      <div className="corrugated absolute inset-0" aria-hidden />
      <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-accent-500/15 blur-3xl" aria-hidden />
      <LoginForm next={next} />
    </div>
  );
}
