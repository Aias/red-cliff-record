/*
  Warnings:

  - Made the column `michelinStars` on table `Extract` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "extension" TEXT;

-- AlterTable
ALTER TABLE "Extract" ALTER COLUMN "michelinStars" SET NOT NULL,
ALTER COLUMN "michelinStars" SET DEFAULT 0;
