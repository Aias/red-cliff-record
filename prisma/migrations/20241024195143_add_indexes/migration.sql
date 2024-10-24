-- CreateIndex
CREATE INDEX "Attachment_extension_idx" ON "Attachment"("extension");

-- CreateIndex
CREATE INDEX "Creator_name_idx" ON "Creator"("name");

-- CreateIndex
CREATE INDEX "Creator_createdAt_idx" ON "Creator"("createdAt");

-- CreateIndex
CREATE INDEX "Creator_updatedAt_idx" ON "Creator"("updatedAt");

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
CREATE INDEX "ExtractFormat_name_idx" ON "ExtractFormat"("name");

-- CreateIndex
CREATE INDEX "ExtractRelation_annotation_idx" ON "ExtractRelation"("annotation");

-- CreateIndex
CREATE INDEX "Space_topic_idx" ON "Space"("topic");

-- CreateIndex
CREATE INDEX "Space_createdAt_idx" ON "Space"("createdAt");

-- CreateIndex
CREATE INDEX "Space_updatedAt_idx" ON "Space"("updatedAt");
