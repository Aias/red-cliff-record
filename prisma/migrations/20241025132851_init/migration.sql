-- CreateTable
CREATE TABLE "Extract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "extract" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "michelinStars" INTEGER NOT NULL DEFAULT 0,
    "formatId" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedOn" DATETIME,
    "childOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Extract_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "ExtractFormat" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Extract_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Extract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractRelation" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "annotation" TEXT,

    PRIMARY KEY ("fromId", "toId"),
    CONSTRAINT "ExtractRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Extract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Extract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "altText" TEXT,
    "extractId" TEXT NOT NULL,
    "extension" TEXT,
    CONSTRAINT "Attachment_extractId_fkey" FOREIGN KEY ("extractId") REFERENCES "Extract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "siteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "title" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_ExtractSpaces" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ExtractSpaces_A_fkey" FOREIGN KEY ("A") REFERENCES "Extract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ExtractSpaces_B_fkey" FOREIGN KEY ("B") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ExtractCreators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ExtractCreators_A_fkey" FOREIGN KEY ("A") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ExtractCreators_B_fkey" FOREIGN KEY ("B") REFERENCES "Extract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Extract_createdAt_idx" ON "Extract"("createdAt");

-- CreateIndex
CREATE INDEX "Extract_updatedAt_idx" ON "Extract"("updatedAt");

-- CreateIndex
CREATE INDEX "Extract_publishedOn_idx" ON "Extract"("publishedOn");

-- CreateIndex
CREATE INDEX "Extract_publishedOn_createdAt_idx" ON "Extract"("publishedOn", "createdAt");

-- CreateIndex
CREATE INDEX "Extract_parentId_childOrder_idx" ON "Extract"("parentId", "childOrder");

-- CreateIndex
CREATE INDEX "ExtractRelation_annotation_idx" ON "ExtractRelation"("annotation");

-- CreateIndex
CREATE INDEX "ExtractFormat_name_idx" ON "ExtractFormat"("name");

-- CreateIndex
CREATE INDEX "Attachment_extension_idx" ON "Attachment"("extension");

-- CreateIndex
CREATE INDEX "Creator_name_idx" ON "Creator"("name");

-- CreateIndex
CREATE INDEX "Creator_createdAt_idx" ON "Creator"("createdAt");

-- CreateIndex
CREATE INDEX "Creator_updatedAt_idx" ON "Creator"("updatedAt");

-- CreateIndex
CREATE INDEX "Space_topic_idx" ON "Space"("topic");

-- CreateIndex
CREATE INDEX "Space_createdAt_idx" ON "Space"("createdAt");

-- CreateIndex
CREATE INDEX "Space_updatedAt_idx" ON "Space"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ExtractSpaces_AB_unique" ON "_ExtractSpaces"("A", "B");

-- CreateIndex
CREATE INDEX "_ExtractSpaces_B_index" ON "_ExtractSpaces"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ExtractCreators_AB_unique" ON "_ExtractCreators"("A", "B");

-- CreateIndex
CREATE INDEX "_ExtractCreators_B_index" ON "_ExtractCreators"("B");
