import Link from "next/link";
import { Check, Mail, Phone, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteRequestAction, setRequestStatusAction } from "@/app/admin/actions/content";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/admin/badges";
import { ConfirmSubmit } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Requests" };

type Kind = "quote" | "inspection" | "message";
const TABS: { kind: Kind; label: string }[] = [
  { kind: "quote", label: "Quotes" },
  { kind: "inspection", label: "Inspections" },
  { kind: "message", label: "Messages" },
];

interface Row {
  id: string;
  status: string;
  createdAt: Date;
  title: string;
  email: string;
  phone?: string;
  lines: [string, string | null | undefined][];
  body?: string | null;
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const kind: Kind = (["quote", "inspection", "message"] as const).find((k) => k === sp.tab) ?? "quote";
  const showAll = sp.show === "all";
  const where = showAll ? {} : { status: "NEW" };

  const [counts, rows] = await Promise.all([
    Promise.all([db.quoteRequest.count({ where: { status: "NEW" } }), db.inspectionRequest.count({ where: { status: "NEW" } }), db.contactMessage.count({ where: { status: "NEW" } })]),
    loadRows(kind, where),
  ]);

  return (
    <>
      <AdminHeader title="Requests" description="Quote requests, inspection bookings and contact messages." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-ink-900/5">
          {TABS.map((t, i) => (
            <Link key={t.kind} href={`?tab=${t.kind}${showAll ? "&show=all" : ""}`} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold", kind === t.kind ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")}>
              {t.label}
              {counts[i] ? <span className="rounded-full bg-accent-500 px-1.5 text-[11px] text-white">{counts[i]}</span> : null}
            </Link>
          ))}
        </div>
        <Link href={`?tab=${kind}${showAll ? "" : "&show=all"}`} className="ml-auto text-sm text-brand-600 hover:underline">
          {showAll ? "Show new only" : "Show handled too"}
        </Link>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className={cn("rounded-2xl bg-white p-5 ring-1 ring-ink-900/5", r.status === "HANDLED" && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.title} {r.status === "NEW" ? <Badge tone="amber" className="ml-1">new</Badge> : <Badge className="ml-1">handled</Badge>}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Mail className="size-3.5" />{r.email}</a>
                  {r.phone ? <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Phone className="size-3.5" />{r.phone}</a> : null}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 text-xs text-ink-400">{r.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
                <form action={setRequestStatusAction.bind(null, kind, r.id, r.status === "NEW" ? "HANDLED" : "NEW")}>
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-50">
                    {r.status === "NEW" ? <><Check className="size-4" /> Mark handled</> : <><RotateCcw className="size-4" /> Reopen</>}
                  </button>
                </form>
                <form action={deleteRequestAction.bind(null, kind, r.id)}>
                  <ConfirmSubmit message="Delete this request permanently?"><Trash2 className="size-4" /></ConfirmSubmit>
                </form>
              </div>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {r.lines.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="inline text-ink-500">{k}: </dt><dd className="inline font-medium">{v}</dd></div>
              ))}
            </dl>
            {r.body ? <p className="mt-3 rounded-xl bg-ink-50 p-3 text-sm whitespace-pre-line">{r.body}</p> : null}
          </li>
        ))}
        {!rows.length ? <li className="rounded-2xl bg-white p-12 text-center text-ink-500 ring-1 ring-ink-900/5">Nothing here. 🎉</li> : null}
      </ul>
    </>
  );
}

async function loadRows(kind: Kind, where: { status?: string }): Promise<Row[]> {
  const opts = { where, orderBy: { createdAt: "desc" as const }, take: 100 };
  if (kind === "quote") {
    return (await db.quoteRequest.findMany(opts)).map((q) => ({
      id: q.id, status: q.status, createdAt: q.createdAt, title: q.companyName, email: q.email, phone: q.phone,
      lines: [["Size", q.size || "Any"], ["Quantity", q.quantity], ["Condition", q.condition.toLowerCase()]], body: q.message,
    }));
  }
  if (kind === "inspection") {
    return (await db.inspectionRequest.findMany(opts)).map((r) => ({
      id: r.id, status: r.status, createdAt: r.createdAt, title: r.fullName, email: r.email, phone: r.phone,
      lines: [["Terminal", r.terminal], ["Preferred date", r.preferredDate.toDateString()], ["Container", r.containerSlug]], body: r.notes,
    }));
  }
  return (await db.contactMessage.findMany(opts)).map((m) => ({
    id: m.id, status: m.status, createdAt: m.createdAt, title: m.subject, email: m.email, lines: [["From", m.fullName]], body: m.message,
  }));
}
