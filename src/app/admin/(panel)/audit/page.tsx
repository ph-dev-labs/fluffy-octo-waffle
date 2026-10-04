import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireAdmin({ role: "OWNER" });
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { name: true, email: true } } } });
  return (
    <>
      <AdminHeader title="Audit log" description="Every sign-in and admin change, newest first (last 300)." />
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">Who</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Target</th>
                <th className="px-3 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((l) => (
                <tr key={l.id} className={l.action.includes("failed") || l.action.includes("locked") ? "bg-danger-100/40" : ""}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-500">{l.createdAt.toLocaleString("en-NG", { dateStyle: "short", timeStyle: "medium" })}</td>
                  <td className="px-3 py-2.5">{l.user?.name ?? <span className="text-ink-400">—</span>}</td>
                  <td className="px-3 py-2.5"><code className="text-xs">{l.action}</code></td>
                  <td className="max-w-48 truncate px-3 py-2.5 text-ink-600">{l.target}</td>
                  <td className="max-w-80 truncate px-3 py-2.5 text-ink-500" title={l.detail ?? ""}>{l.detail}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-400">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
