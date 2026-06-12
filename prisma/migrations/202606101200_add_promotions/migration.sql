-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('local', 'site', 'both');

-- CreateTable
CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "PromotionType" NOT NULL,
  "promotionalPriceCents" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ComandaItem"
ADD COLUMN "promotionId" TEXT,
ADD COLUMN "promotionType" "PromotionType",
ADD COLUMN "originalUnitPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "WebOrderItem"
ADD COLUMN "promotionId" TEXT,
ADD COLUMN "promotionType" "PromotionType",
ADD COLUMN "originalUnitPriceCents" INTEGER;

-- CreateIndex
CREATE INDEX "Promotion_productId_type_startsAt_endsAt_idx" ON "Promotion"("productId", "type", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_isActive_startsAt_endsAt_idx" ON "Promotion"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ComandaItem_promotionId_idx" ON "ComandaItem"("promotionId");

-- CreateIndex
CREATE INDEX "WebOrderItem_promotionId_idx" ON "WebOrderItem"("promotionId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderItem" ADD CONSTRAINT "WebOrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
