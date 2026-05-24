-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable: Customer ganha campo isGuest e passwordHash vira opcional
ALTER TABLE "Customer" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable: WebOrder ganha deliveryMode obrigatorio
-- Usa default temporario PICKUP para nao quebrar com registros existentes,
-- e em seguida remove o default para forcar valor explicito nos novos inserts.
ALTER TABLE "WebOrder" ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'PICKUP';
ALTER TABLE "WebOrder" ALTER COLUMN "deliveryMode" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Customer_isGuest_idx" ON "Customer"("isGuest");
