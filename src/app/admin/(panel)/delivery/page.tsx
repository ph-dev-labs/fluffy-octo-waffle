import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteZoneAction } from "@/app/admin/actions/content";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card, ConfirmSubmit } from "@/components/admin/ui";
import { ZoneForm } from "@/components/admin/forms/ContentForms";

export const metadata = { title: "Delivery rates" };

export default async function DeliveryPage() {
  await requireAdmin();
  const zones = await db.deliveryZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
  return (
    <>
      <AdminHeader title="Delivery rates" description="Flat delivery fee per container, by region. Changes apply to new checkouts immediately; existing orders keep the price they paid." />
      <Card title="Regions" className="mb-6">
        <div className="space-y-4">
          {zones.map((z) => (
            <div key={z.id} className="flex items-start gap-2">
              <div className="flex-1"><ZoneForm zone={z} /></div>
              <form action={deleteZoneAction.bind(null, z.id)} className="pt-7">
                <ConfirmSubmit message={`Delete region "${z.label}"? Customers will no longer be able to choose it.`}><Trash2 className="size-4" /></ConfirmSubmit>
              </form>
            </div>
          ))}
          {!zones.length ? <p className="text-sm text-ink-500">No regions yet — customers can only choose pickup.</p> : null}
        </div>
      </Card>
      <Card title="Add a region">
        <ZoneForm />
      </Card>
    </>
  );
}
