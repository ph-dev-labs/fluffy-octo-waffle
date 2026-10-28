-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "customerAddress" TEXT,
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryKobo" INTEGER,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "lines" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "quoteRequestId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_quoteRequestId_idx" ON "Invoice"("quoteRequestId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

