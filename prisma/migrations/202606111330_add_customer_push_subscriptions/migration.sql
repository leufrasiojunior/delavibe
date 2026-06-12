-- CreateTable
CREATE TABLE "CustomerPushSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPushSubscription_endpoint_key" ON "CustomerPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "CustomerPushSubscription_customerId_idx" ON "CustomerPushSubscription"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerPushSubscription" ADD CONSTRAINT "CustomerPushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
