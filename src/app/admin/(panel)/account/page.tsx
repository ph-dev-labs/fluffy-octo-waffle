import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { ChangePasswordForm } from "@/components/admin/forms/ChangePasswordForm";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireAdmin({ allowPasswordChange: true });
  const { first } = await searchParams;
  return (
    <>
      <AdminHeader title="Your account" description={`${user.name} · ${user.email} · ${user.role.toLowerCase()}`} />
      {first || user.mustChangePassword ? (
        <p className="mb-6 rounded-xl bg-warning-100 p-4 text-sm text-warning-600">
          For security, please set a new password before continuing. The temporary password you signed in with will stop working.
        </p>
      ) : null}
      <Card title="Change password" className="max-w-xl">
        <ChangePasswordForm />
      </Card>
    </>
  );
}
