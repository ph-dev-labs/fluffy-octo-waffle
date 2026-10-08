-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryArea" TEXT,
ADD COLUMN     "deliveryDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "deliveryLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryLng" DOUBLE PRECISION,
ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "deliveryState" TEXT,
ADD COLUMN     "deliveryYard" TEXT;

-- AlterTable
ALTER TABLE "DeliveryZone" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'STATE',
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "perContainerKobo" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DeliverySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "distanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "yards" TEXT NOT NULL,
    "baseFeeKobo" INTEGER NOT NULL,
    "ratePerKmKobo" INTEGER NOT NULL,
    "minFeeKobo" INTEGER NOT NULL,
    "maxFeeKobo" INTEGER NOT NULL,
    "maxDistanceKm" INTEGER NOT NULL,
    "roadFactorPct" INTEGER NOT NULL DEFAULT 135,
    "sizeMultipliers" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryZone_parentId_idx" ON "DeliveryZone"("parentId");

-- CreateIndex
CREATE INDEX "DeliveryZone_kind_active_idx" ON "DeliveryZone"("kind", "active");

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data. Schema-only otherwise: the new states, Lagos areas and distance-pricing
-- defaults are inserted by the app on first use (lib/delivery/defaults.ts), so
-- the previous deployment, still live while this build runs, never sees an
-- unpriced zone. Old regions stay active (old code still needs them) but are
-- marked REGION, which the new code ignores. LAGOS becomes the Lagos state and
-- keeps its price.
UPDATE "DeliveryZone" SET "kind" = 'REGION' WHERE "code" <> 'LAGOS';
UPDATE "DeliveryZone" SET "kind" = 'STATE', "label" = 'Lagos', "parentId" = NULL WHERE "code" = 'LAGOS';
