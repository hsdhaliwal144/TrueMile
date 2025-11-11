-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "distance" DOUBLE PRECISION,
    "totalRate" DOUBLE PRECISION,
    "ratePerMile" DOUBLE PRECISION,
    "equipment" TEXT,
    "weight" TEXT,
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "broker" TEXT,
    "brokerEmail" TEXT,
    "brokerPhone" TEXT,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fitReason" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerStats" (
    "id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "brokerEmail" TEXT,
    "totalLoads" INTEGER NOT NULL DEFAULT 0,
    "loadsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "loadsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "avgRatePerMile" DOUBLE PRECISION,
    "highestRate" DOUBLE PRECISION,
    "lowestRate" DOUBLE PRECISION,
    "topLanes" JSONB,
    "laneCount" INTEGER NOT NULL DEFAULT 0,
    "firstContactDate" TIMESTAMP(3) NOT NULL,
    "lastContactDate" TIMESTAMP(3) NOT NULL,
    "avgDaysBetween" DOUBLE PRECISION,
    "relationshipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Load_messageId_idx" ON "Load"("messageId");

-- CreateIndex
CREATE INDEX "Load_broker_extractedAt_idx" ON "Load"("broker", "extractedAt");

-- CreateIndex
CREATE INDEX "Load_priorityScore_idx" ON "Load"("priorityScore");

-- CreateIndex
CREATE INDEX "Load_origin_destination_idx" ON "Load"("origin", "destination");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerStats_broker_key" ON "BrokerStats"("broker");

-- CreateIndex
CREATE INDEX "BrokerStats_relationshipScore_idx" ON "BrokerStats"("relationshipScore");

-- CreateIndex
CREATE INDEX "BrokerStats_broker_idx" ON "BrokerStats"("broker");

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
