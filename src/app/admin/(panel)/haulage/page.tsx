import Link from "next/link";
import { AlertTriangle, Settings } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HaulageStatusBadge, HaulagePaidBadge } from "@/components/admin/badges";
import { HAULAGE_JOB_STATUSES } from "@/lib/haulage/calc";
import { cn } from "@/lib/utils";

export const metadata = { title: "Truck hire" };
const PAGE_SIZE = 25;
type SP = { status?: string; review?: string; q?: string; page?: string };

export default async function HaulageListPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 100);
  const where: Prisma.HaulageRequestWhereInput = {
    ...((HAULAGE_JOB_STATUSES as readonly string[]).includes(sp.status ?? "") ? { status: sp.status } : {}),
    ...(sp.review === "1" ? { needsReview: true } : {}),
    ...(q
      ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }, { customerEmail: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.haulageRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.haulageRequest.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Partial<SP>) => `?${new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <AdminHeader
        title="Truck hire"
        description={`${total} booking${total === 1 ? "" : "s"} — customers moving their own containers`}
        actions={
          <Link href="/admin/haulage/settings" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
            <Settings className="size-4" /> Pricing & deposit
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-ink-900/5">
          {["ALL", ...HAULAGE_JOB_STATUSES].map((s) => {
            const active = (sp.status ?? "ALL") === s;
            return (
              <Link key={s} href={qs({ status: s === "ALL" ? undefined : s, page: undefined })} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap", active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")}>
                {s.replace("_", " ").toLowerCase()}
              </Link>
            );
          })}
        </div>
        <Link href={qs({ review: sp.review === "1" ? undefined : "1", page: undefined })} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold", sp.review === "1" ? "bg-danger-600 text-white" : "bg-white text-danger-600 ring-1 ring-ink-900/5")}>
          <AlertTriangle className="size-3.5" /> Needs review
        </Link>
        <form className="lg:ml-auto">
          {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
          <input name="q" defaultValue={sp.q} placeholder="Reference, name, email, phone…" className="h-10 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm outline-none focus:border-brand-500 lg:w-72" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Route</th>
                <th className="px-3 py-3 font-medium">Paid / total</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/haulage/${r.id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{r.reference}</Link>
                    {r.needsReview ? <AlertTriangle className="ml-2 inline size-3.5 text-danger-600" aria-label="Needs review" /> : null}
                  </td>
                  <td className="px-3 py-3">{r.customerName}<span className="block text-xs text-ink-400">{r.customerPhone}</span></td>
                  <td className="px-3 py-3 text-xs">{r.pickupState ?? "?"} → {r.dropoffState ?? "?"}<span className="block text-ink-400">{r.containerCount} × {r.containerSize} · {Math.round(r.distanceKm)} km</span></td>
                  <td className="px-3 py-3 tabular-nums">{formatNaira(r.paidKobo)} / {formatNaira(r.totalKobo)}<div className="mt-1"><HaulagePaidBadge total={r.totalKobo} paid={r.paidKobo} /></div></td>
                  <td className="px-3 py-3"><HaulageStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-ink-500">{r.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-500">No truck bookings yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-ink-200">Previous</Link> : null}
            {page < pages ? <Link href={qs({ page: String(page + 1) })} className="rounded-lg px-3 py-1.5 ring-1 ring-ink-200">Next</Link> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
