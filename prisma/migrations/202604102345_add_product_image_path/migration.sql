ALTER TABLE "Product" ADD COLUMN "imagePath" TEXT;

UPDATE "Product"
SET "imagePath" = '/catalog-placeholder.jpg'
WHERE "imagePath" IS NULL;
