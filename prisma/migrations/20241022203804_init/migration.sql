-- CreateTable
CREATE TABLE "Extract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "extract" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "michelinStars" INTEGER,
    "formatId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedOn" TIMESTAMP(3),

    CONSTRAINT "Extract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractRelation" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "annotation" TEXT,

    CONSTRAINT "ExtractRelation_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE "ExtractFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExtractFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExtractToSpace" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AttachmentToExtract" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CreatorToExtract" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ExtractToSpace_AB_unique" ON "_ExtractToSpace"("A", "B");

-- CreateIndex
CREATE INDEX "_ExtractToSpace_B_index" ON "_ExtractToSpace"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AttachmentToExtract_AB_unique" ON "_AttachmentToExtract"("A", "B");

-- CreateIndex
CREATE INDEX "_AttachmentToExtract_B_index" ON "_AttachmentToExtract"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CreatorToExtract_AB_unique" ON "_CreatorToExtract"("A", "B");

-- CreateIndex
CREATE INDEX "_CreatorToExtract_B_index" ON "_CreatorToExtract"("B");

-- AddForeignKey
ALTER TABLE "Extract" ADD CONSTRAINT "Extract_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "ExtractFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extract" ADD CONSTRAINT "Extract_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Extract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractRelation" ADD CONSTRAINT "ExtractRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Extract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractRelation" ADD CONSTRAINT "ExtractRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Extract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractToSpace" ADD CONSTRAINT "_ExtractToSpace_A_fkey" FOREIGN KEY ("A") REFERENCES "Extract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExtractToSpace" ADD CONSTRAINT "_ExtractToSpace_B_fkey" FOREIGN KEY ("B") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachmentToExtract" ADD CONSTRAINT "_AttachmentToExtract_A_fkey" FOREIGN KEY ("A") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachmentToExtract" ADD CONSTRAINT "_AttachmentToExtract_B_fkey" FOREIGN KEY ("B") REFERENCES "Extract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CreatorToExtract" ADD CONSTRAINT "_CreatorToExtract_A_fkey" FOREIGN KEY ("A") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CreatorToExtract" ADD CONSTRAINT "_CreatorToExtract_B_fkey" FOREIGN KEY ("B") REFERENCES "Extract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
