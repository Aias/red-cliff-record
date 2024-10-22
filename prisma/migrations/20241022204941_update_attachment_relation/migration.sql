/*
  Warnings:

  - You are about to drop the `_AttachmentToExtract` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `extractId` to the `Attachment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_AttachmentToExtract" DROP CONSTRAINT "_AttachmentToExtract_A_fkey";

-- DropForeignKey
ALTER TABLE "_AttachmentToExtract" DROP CONSTRAINT "_AttachmentToExtract_B_fkey";

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "extractId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_AttachmentToExtract";

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_extractId_fkey" FOREIGN KEY ("extractId") REFERENCES "Extract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
