import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { setAdminRoleAction, toggleAdminActiveAction } from "@/app/admin/actions/users";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/admin/badges";
import { Card } from "@/components/admin/ui";
import { CreateAdminForm, ResetPasswordButton } from "@/components/admin/forms/ContentForms";

export const metadata = { title: "Admin users" };

export default async function UsersPage() {
  const me = await requireAdmin({ role: "OWNER" });
  const users = await db.adminUser.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return (
    <>
      <AdminHeader title="Admin users" description="Owners can manage admins and see the audit log. Admins can manage everything else." />
      <Card title="Add an admin" className="mb-6">
        <CreateAdminForm />
        <p className="mt-3 text-xs text-ink-400">A one-time temporary password is generated. Share it privately; they must change it at first sign-in.</p>
      </Card>
      <div className="space-y-3">
        {users.map((u) => {
          const self = u.id === me.id;
          return (
            <Card key={u.id} className={u.active ? "" : "opacity-60"}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {u.name} {self ? <span className="text-xs font-normal text-ink-400">(you)</span> : null}
                  </p>
                  <p className="text-sm text-ink-500">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={u.role === "OWNER" ? "blue" : "grey"}>{u.role.toLowerCase()}</Badge>
                    {!u.active ? <Badge tone="red">deactivated</Badge> : null}
                    {u.mustChangePassword ? <Badge tone="amber">must change password</Badge> : null}
                    {u.lockedUntil && u.lockedUntil > new Date() ? <Badge tone="red">locked</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-ink-400">Last sign-in: {u.lastLoginAt?.toLocaleString("en-NG") ?? "never"}</p>
                </div>
                {!self ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <form action={setAdminRoleAction.bind(null, u.id, u.role === "OWNER" ? "ADMIN" : "OWNER")}>
                      <button className="h-10 rounded-xl px-3 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-50">{u.role === "OWNER" ? "Make admin" : "Make owner"}</button>
                    </form>
                    <form action={toggleAdminActiveAction.bind(null, u.id)}>
                      <button className={`h-10 rounded-xl px-3 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-50 ${u.active ? "text-danger-600" : ""}`}>{u.active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                    <ResetPasswordButton id={u.id} />
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
