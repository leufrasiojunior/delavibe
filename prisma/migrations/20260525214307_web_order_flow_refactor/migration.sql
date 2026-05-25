-- AlterEnum
ALTER TYPE "WebOrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';

-- AlterTable
ALTER TABLE "WebOrder" ADD COLUMN     "paidMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[];
