-- AlterEnum
ALTER TYPE "WebOrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';

-- CreateTable
CREATE TABLE "WebOrderPayment" (
    "id" TEXT NOT NULL,
    "webOrderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebOrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebOrderPayment_webOrderId_idx" ON "WebOrderPayment"("webOrderId");

-- CreateIndex
CREATE INDEX "WebOrderPayment_method_idx" ON "WebOrderPayment"("method");

-- AddForeignKey
ALTER TABLE "WebOrderPayment" ADD CONSTRAINT "WebOrderPayment_webOrderId_fkey" FOREIGN KEY ("webOrderId") REFERENCES "WebOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
