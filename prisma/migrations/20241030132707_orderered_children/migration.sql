/*
  Warnings:

  - You are about to drop the column `childOrder` on the `Extract` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Extract_parentId_childOrder_idx";

-- AlterTable
ALTER TABLE "Extract" DROP COLUMN "childOrder",
ADD COLUMN     "orderKey" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Extract_parentId_orderKey_idx" ON "Extract"("parentId", "orderKey");
