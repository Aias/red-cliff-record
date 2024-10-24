/*
  Warnings:

  - Made the column `formatId` on table `Extract` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Extract" DROP CONSTRAINT "Extract_formatId_fkey";

-- AlterTable
ALTER TABLE "Extract" ALTER COLUMN "formatId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Extract" ADD CONSTRAINT "Extract_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "ExtractFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
