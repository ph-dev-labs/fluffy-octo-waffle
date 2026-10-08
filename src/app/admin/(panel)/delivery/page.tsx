import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { ensureDeliveryDefaults, getDeliveryConfig } from "@/lib/delivery/service";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { DeliverySettingsForm, DeliveryTester, ZoneCsv, ZoneTree, type ZoneTreeState } from "@/components/admin/forms/DeliveryForms";

export const metadata = { title: "Delivery pricing" };

export default async function DeliveryPage() {
  await requireAdmin();
  await ensureDeliveryDefaults();
  const [cfg, rows] = await Promise.all([
    getDeliveryConfig(),
    db.deliveryZone.findMany({
      where: { kind: "STATE" },
      orderBy: { label: "asc" },
      select: {
        id: true,
        code: true,
        label: true,
        perContainerKobo: true,
        active: true,
        children: { where: { kind: "AREA" }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, code: true, label: true, perContainerKobo: true, active: true } },
      },
    }),
  ]);
  const states: ZoneTreeState[] = rows.map(({ children, ...s }) => ({ ...s, areas: children }));
  const routing = !!process.env.ORS_API_KEY;

  return (
    <>
      <AdminHeader
        title="Delivery pricing"
        description="Customers drop a pin at checkout. Price used, in order: the area's fixed rate → the state's fixed rate → distance from your nearest yard → 'contact us for a quote'. All prices are per 20ft container. Existing orders keep the price they paid."
      />

      <div className="space-y-6">
        <Card title="States & areas — fixed rates">
          <ZoneTree states={states} distanceEnabled={cfg.distanceEnabled} />
        </Card>

        <Card title="Distance pricing">
          {!routing ? (
            <p className="mb-5 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">
              Distances are currently straight-line estimates. Add a free <strong>ORS_API_KEY</strong> (openrouteservice.org) in Vercel to use real truck road distances.
            </p>
          ) : null}
          <DeliverySettingsForm
            settings={{
              distanceEnabled: cfg.distanceEnabled,
              yards: cfg.yards,
              baseFeeKobo: cfg.baseFeeKobo,
              ratePerKmKobo: cfg.ratePerKmKobo,
              minFeeKobo: cfg.minFeeKobo,
              maxFeeKobo: cfg.maxFeeKobo,
              maxDistanceKm: cfg.maxDistanceKm,
              roadFactorPct: cfg.roadFactorPct,
              sizeMultipliers: cfg.sizeMultipliers,
              routing,
            }}
          />
        </Card>

        <Card title="Test a location">
          <DeliveryTester states={states} />
        </Card>

        <Card title="Bulk update (CSV)">
          <ZoneCsv states={states} />
        </Card>
      </div>
    </>
  );
}
