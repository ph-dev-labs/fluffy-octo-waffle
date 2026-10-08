import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getHaulageConfig } from "@/lib/haulage/service";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { HaulageSettingsForm } from "@/components/admin/forms/HaulageForms";

export const metadata = { title: "Truck hire pricing" };

export default async function HaulageSettingsPage() {
  await requireAdmin();
  const cfg = await getHaulageConfig();
  return (
    <>
      <Link href="/admin/haulage" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Truck hire</Link>
      <AdminHeader title="Truck hire pricing" description="Customers moving their own container are priced by the road distance from their pickup pin to their drop-off pin. Existing bookings keep the price they were quoted." />
      {!process.env.ORS_API_KEY ? (
        <p className="mb-6 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">Distances are straight-line estimates until <strong>ORS_API_KEY</strong> is set in Vercel.</p>
      ) : null}
      <Card>
        <HaulageSettingsForm settings={cfg} />
      </Card>
    </>
  );
}
