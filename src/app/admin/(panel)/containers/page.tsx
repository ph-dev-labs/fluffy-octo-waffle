import Link from "next/link";
import { Eye, EyeOff, Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { parseImages } from "@/lib/utils";
import { SIZE_LABELS } from "@/lib/catalog";
import { toggleContainerAction } from "@/app/admin/actions/containers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/admin/badges";
import SmartImage from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";

export const metadata = { title: "Containers" };

export default async function ContainersPage({ searchParams }: { searchParams: Promise<{ q?: string; created?: string }> }) {
  await requireAdmin();
  const { q, created } = await searchParams;
  const query = q?.trim().slice(0, 80);
  const rows = await db.container.findMany({
    where: query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { terminal: { contains: query, mode: "insensitive" } }] } : undefined,
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { orderItems: true } } },
  });

  return (
    <>
      <AdminHeader
        title="Containers"
        description={`${rows.length} listing${rows.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/admin/containers/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            <Plus className="size-4" /> New container
          </Link>
        }
      />
      {created ? <p className="mb-4 rounded-xl bg-success-100 p-3 text-sm text-success-600">Container created.</p> : null}

      <form className="mb-4">
        <input name="q" defaultValue={query} placeholder="Search title or terminal…" className="h-10 w-full max-w-sm rounded-xl border border-ink-200 bg-white px-4 text-sm outline-none focus:border-brand-500" />
      </form>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Container</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Stock</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Quick actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((c) => {
                const img = parseImages(c.images)[0];
                return (
                  <tr key={c.id} className={cn("hover:bg-ink-50", !c.active && "opacity-60")}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/containers/${c.id}`} className="flex items-center gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-ink-100">{img ? <SmartImage src={img} alt="" fill sizes="48px" className="object-cover" /> : null}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold hover:text-brand-600">{c.title}</span>
                          <span className="block truncate text-xs text-ink-500">{SIZE_LABELS[c.size]} · {c.terminal}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatNaira(c.priceKobo)}</td>
                    <td className="px-3 py-3">
                      <span className={cn("tabular-nums", c.stock === 0 && "font-semibold text-danger-600")}>{c.stock}</span>
                    </td>
                    <td className="space-x-1 px-3 py-3">
                      {c.active ? <Badge tone="green">live</Badge> : <Badge>hidden</Badge>}
                      {c.featured ? <Badge tone="blue">featured</Badge> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <form action={toggleContainerAction.bind(null, c.id, "featured")}>
                          <button className={cn("grid size-9 place-items-center rounded-lg hover:bg-ink-100", c.featured ? "text-accent-500" : "text-ink-400")} title={c.featured ? "Unfeature" : "Feature on homepage"} aria-label="Toggle featured">
                            <Star className={cn("size-4", c.featured && "fill-current")} />
                          </button>
                        </form>
                        <form action={toggleContainerAction.bind(null, c.id, "active")}>
                          <button className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100" title={c.active ? "Hide from store" : "Show in store"} aria-label="Toggle visibility">
                            {c.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink-500">No containers found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
