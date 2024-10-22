/*
  Warnings:

  - You are about to drop the `_CreatorToExtract` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExtractToSpace` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CreatorToExtract" DROP CONSTRAINT "_CreatorToExtract_A_fkey";

-- DropForeignKey
ALTER TABLE "_CreatorToExtract" DROP CONSTRAINT "_CreatorToExtract_B_fkey";

-- DropForeignKey
ALTER TABLE "_ExtractToSpace" DROP CONSTRAINT "_ExtractToSpace_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExtractToSpace" DROP CONSTRAINT "_ExtractToSpace_B_fkey";

-- DropTable
DROP TABLE "_CreatorToExtract";

-- DropTable
DROP TABLE "_ExtractToSpace";

-- CreateTable
CREATE TABLE "_ExtractSpaces" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ExtractCreators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ExtractSpaces_AB_unique" ON "_ExtractSpaces"("A", "B");

-- CreateIndex
CREATE INDEX "_ExtractSpaces_B_index" ON "_ExtractSpaces"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ExtractCreators_AB_unique" ON "_ExtractCreators"("A", "B");

-- CreateIndex
CREATE INDEX "_ExtractCreators_B_index" ON "_ExtractCreators"("B");

-- AddForeignKey
ALTER TABLE "_ExtractSpaces" ADD CONSTRAINT "_ExtractSpaces_A_fkey" FOREIGN KEY ("A") REFERENCES "Extract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractSpaces" ADD CONSTRAINT "_ExtractSpaces_B_fkey" FOREIGN KEY ("B") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractCreators" ADD CONSTRAINT "_ExtractCreators_A_fkey" FOREIGN KEY ("A") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractCreators" ADD CONSTRAINT "_ExtractCreators_B_fkey" FOREIGN KEY ("B") REFERENCES "Extract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
