/*
  Warnings:

  - You are about to drop the column `extract` on the `Extract` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL DEFAULT '',
    "caption" TEXT,
    "altText" TEXT,
    "extractId" TEXT NOT NULL,
    "extension" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Attachment_extractId_fkey" FOREIGN KEY ("extractId") REFERENCES "Extract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("altText", "caption", "extension", "extractId", "id", "url") SELECT "altText", "caption", coalesce("extension", '') AS "extension", "extractId", "id", "url" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_extension_idx" ON "Attachment"("extension");
CREATE TABLE "new_Extract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
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
INSERT INTO "new_Extract" ("childOrder", "createdAt", "formatId", "id", "michelinStars", "notes", "parentId", "publishedOn", "sourceUrl", "title", "updatedAt") SELECT "childOrder", "createdAt", "formatId", "id", "michelinStars", "notes", "parentId", "publishedOn", "sourceUrl", "title", "updatedAt" FROM "Extract";
DROP TABLE "Extract";
ALTER TABLE "new_Extract" RENAME TO "Extract";
CREATE INDEX "Extract_createdAt_idx" ON "Extract"("createdAt");
CREATE INDEX "Extract_updatedAt_idx" ON "Extract"("updatedAt");
CREATE INDEX "Extract_publishedOn_idx" ON "Extract"("publishedOn");
CREATE INDEX "Extract_publishedOn_createdAt_idx" ON "Extract"("publishedOn", "createdAt");
CREATE INDEX "Extract_parentId_childOrder_idx" ON "Extract"("parentId", "childOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
