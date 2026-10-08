-- CreateTable
CREATE TABLE "HaulageRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "companyName" TEXT,
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "pickupState" TEXT,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLat" DOUBLE PRECISION NOT NULL,
    "dropoffLng" DOUBLE PRECISION NOT NULL,
    "dropoffState" TEXT,
    "containerSize" TEXT NOT NULL,
    "containerCount" INTEGER NOT NULL,
    "containerNumbers" TEXT,
    "preferredDate" TIMESTAMP(3),
    "notes" TEXT,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "priceMethod" TEXT NOT NULL,
    "perContainerKobo" INTEGER NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "depositPct" INTEGER NOT NULL,
    "paidKobo" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "scheduledFor" TIMESTAMP(3),
    "driverName" TEXT,
    "driverPhone" TEXT,
    "truckPlate" TEXT,
    "adminNote" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaulageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaulagePayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "initAttempts" INTEGER NOT NULL DEFAULT 0,
    "paystackAccessCode" TEXT,
    "paystackAuthUrl" TEXT,
    "paystackTransactionId" TEXT,
    "channel" TEXT,
    "gatewayResponse" TEXT,
    "paidAt" TIMESTAMP(3),
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),
    "receiptSentAt" TIMESTAMP(3),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaulagePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaulageSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baseFeeKobo" INTEGER NOT NULL,
    "ratePerKmKobo" INTEGER NOT NULL,
    "minFeeKobo" INTEGER NOT NULL,
    "maxFeeKobo" INTEGER NOT NULL,
    "maxDistanceKm" INTEGER NOT NULL,
    "sizeMultipliers" TEXT NOT NULL,
    "allowDeposit" BOOLEAN NOT NULL DEFAULT true,
    "depositPct" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaulageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HaulageRequest_reference_key" ON "HaulageRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "HaulageRequest_idempotencyKey_key" ON "HaulageRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HaulageRequest_status_createdAt_idx" ON "HaulageRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HaulageRequest_needsReview_idx" ON "HaulageRequest"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "HaulagePayment_reference_key" ON "HaulagePayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "HaulagePayment_idempotencyKey_key" ON "HaulagePayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HaulagePayment_requestId_idx" ON "HaulagePayment"("requestId");

-- CreateIndex
CREATE INDEX "HaulagePayment_status_createdAt_idx" ON "HaulagePayment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "HaulagePayment" ADD CONSTRAINT "HaulagePayment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HaulageRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

