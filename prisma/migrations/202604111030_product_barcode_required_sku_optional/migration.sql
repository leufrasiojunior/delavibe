UPDATE "Product"
SET "barcode" = CONCAT('AUTO-', "id")
WHERE "barcode" IS NULL;

ALTER TABLE "Product"
ALTER COLUMN "sku" DROP NOT NULL,
ALTER COLUMN "barcode" SET NOT NULL;
