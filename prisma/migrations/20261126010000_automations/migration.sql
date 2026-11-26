-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remarketingStep" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RemarketingStep" (
    "id" TEXT NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "mediaType" "MediaType",
    "fileId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemarketingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "mediaType" "MediaType",
    "fileId" TEXT,
    "caption" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "PostStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_remarketingStep_ageConfirmedAt_idx" ON "User"("remarketingStep", "ageConfirmedAt");

-- CreateIndex
CREATE INDEX "RemarketingStep_delayHours_idx" ON "RemarketingStep"("delayHours");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_scheduledAt_idx" ON "ScheduledPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_createdAt_idx" ON "ScheduledPost"("status", "createdAt");
