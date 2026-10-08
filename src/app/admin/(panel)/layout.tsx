import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { Sidebar } from "@/components/admin/Sidebar";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // allowPasswordChange: the account page must stay reachable for first-login password change.
  // Every page/action below still calls requireAdmin() itself.
  const user = await requireAdmin({ allowPasswordChange: true });
  const [review, quotes, inspections, messages, haulage] = await Promise.all([
    db.order.count({ where: { needsReview: true } }),
    db.quoteRequest.count({ where: { status: "NEW" } }),
    db.inspectionRequest.count({ where: { status: "NEW" } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    // Paid truck bookings not yet scheduled, plus anything flagged for review.
    db.haulageRequest.count({ where: { OR: [{ status: "CONFIRMED" }, { needsReview: true }] } }),
  ]);

  return (
    <>
      <Sidebar user={user} badges={{ review, requests: quotes + inspections + messages, haulage }} />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </div>
    </>
  );
}
