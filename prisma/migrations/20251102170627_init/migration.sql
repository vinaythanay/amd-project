-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'RINGING', 'ANSWERED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER', 'CANCELED');

-- CreateEnum
CREATE TYPE "AmdResult" AS ENUM ('HUMAN', 'MACHINE', 'UNDECIDED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetNumber" TEXT NOT NULL,
    "twilioCallSid" TEXT,
    "amdStrategy" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "amdResult" "AmdResult" DEFAULT 'UNDECIDED',
    "amdConfidence" DOUBLE PRECISION,
    "duration" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amd_events" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amdResult" "AmdResult",
    "confidence" DOUBLE PRECISION,
    "rawData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amd_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "calls_twilioCallSid_key" ON "calls"("twilioCallSid");

-- CreateIndex
CREATE INDEX "calls_userId_idx" ON "calls"("userId");

-- CreateIndex
CREATE INDEX "calls_createdAt_idx" ON "calls"("createdAt");

-- CreateIndex
CREATE INDEX "calls_amdStrategy_idx" ON "calls"("amdStrategy");

-- CreateIndex
CREATE INDEX "amd_events_callId_idx" ON "amd_events"("callId");

-- CreateIndex
CREATE INDEX "amd_events_timestamp_idx" ON "amd_events"("timestamp");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amd_events" ADD CONSTRAINT "amd_events_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
