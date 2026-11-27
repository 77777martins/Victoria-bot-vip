-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'PIX_MANUAL';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "pixTxid" TEXT,
ADD COLUMN     "proofFileId" TEXT,
ADD COLUMN     "proofSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_pixTxid_key" ON "Payment"("pixTxid");
