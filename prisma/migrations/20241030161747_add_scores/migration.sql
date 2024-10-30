-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Extract_score_idx" ON "Extract"("score");

-- CreateIndex
CREATE INDEX "Creator_score_idx" ON "Creator"("score");

-- CreateIndex
CREATE INDEX "Space_score_idx" ON "Space"("score");

-- Create function for score calculation
CREATE OR REPLACE FUNCTION calculate_extract_score(
  michelinStars INT,
  childCount BIGINT,
  hasParent BOOLEAN,
  connectionCount BIGINT,
  spaceCount BIGINT,
  creatorCount BIGINT,
  attachmentCount BIGINT,
  hasNotes BOOLEAN,
  hasSource BOOLEAN,
  hasContent BOOLEAN,
  hasImageCaption BOOLEAN
) RETURNS INT AS $$
BEGIN
  RETURN (michelinStars + 1) * ROUND(SQRT(
    michelinStars + 
    childCount + 
    CASE WHEN hasParent THEN 2 ELSE 0 END +
    (connectionCount * 2) +
    (spaceCount / 2.0) +
    (creatorCount) +
    (attachmentCount * 2) +
    CASE WHEN hasNotes THEN 2 ELSE 0 END +
    CASE WHEN hasSource THEN 2 ELSE 0 END +
    CASE WHEN hasContent THEN 4 ELSE 0 END +
    CASE WHEN hasImageCaption THEN 4 ELSE 0 END
  ));
END;
$$ LANGUAGE plpgsql;

-- Create functions for Creator and Space score calculations
CREATE OR REPLACE FUNCTION calculate_creator_space_score(
  total_extract_score BIGINT,
  extract_count BIGINT
) RETURNS INT AS $$
BEGIN
  IF extract_count = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(total_extract_score / SQRT(extract_count));
END;
$$ LANGUAGE plpgsql;

-- Update function for Extract counts
CREATE OR REPLACE FUNCTION update_extract_counts() RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  -- For ExtractRelation table
  IF TG_TABLE_NAME = 'ExtractRelation' THEN
    IF TG_OP = 'DELETE' THEN
      -- Update score for the source extract
      UPDATE "Extract" SET
        "score" = calculate_extract_score(
          "michelinStars",
          "childCount",
          "parentId" IS NOT NULL,
          (SELECT COUNT(*) FROM "ExtractRelation" WHERE "fromId" = OLD."fromId"),
          "spaceCount",
          "creatorCount",
          (SELECT COUNT(*) FROM "Attachment" WHERE "extractId" = OLD."fromId"),
          "notes" IS NOT NULL,
          "sourceUrl" IS NOT NULL,
          "content" IS NOT NULL,
          EXISTS (SELECT 1 FROM "Attachment" WHERE "extractId" = OLD."fromId" AND "caption" IS NOT NULL)
        )
      WHERE id = OLD."fromId";
    ELSE
      -- Update score for the source extract
      UPDATE "Extract" SET
        "score" = calculate_extract_score(
          "michelinStars",
          "childCount",
          "parentId" IS NOT NULL,
          (SELECT COUNT(*) FROM "ExtractRelation" WHERE "fromId" = NEW."fromId"),
          "spaceCount",
          "creatorCount",
          (SELECT COUNT(*) FROM "Attachment" WHERE "extractId" = NEW."fromId"),
          "notes" IS NOT NULL,
          "sourceUrl" IS NOT NULL,
          "content" IS NOT NULL,
          EXISTS (SELECT 1 FROM "Attachment" WHERE "extractId" = NEW."fromId" AND "caption" IS NOT NULL)
        )
      WHERE id = NEW."fromId";
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For _ExtractSpaces table
  IF TG_TABLE_NAME = '_ExtractSpaces' THEN
    -- Update Extract's spaceCount
    IF TG_OP = 'DELETE' THEN
      UPDATE "Extract" SET
        "spaceCount" = (SELECT COUNT(*) FROM "_ExtractSpaces" WHERE "A" = OLD."A")
      WHERE id = OLD."A";
    ELSE
      UPDATE "Extract" SET
        "spaceCount" = (SELECT COUNT(*) FROM "_ExtractSpaces" WHERE "A" = NEW."A")
      WHERE id = NEW."A";
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

	-- Update Extract's creatorCount
	IF TG_TABLE_NAME = '_ExtractCreators' THEN
    IF TG_OP = 'DELETE' THEN
      UPDATE "Extract" SET
        "creatorCount" = (SELECT COUNT(*) FROM "_ExtractCreators" WHERE "B" = OLD."B")
      WHERE id = OLD."B";
    ELSE
      UPDATE "Extract" SET
				"creatorCount" = (SELECT COUNT(*) FROM "_ExtractCreators" WHERE "B" = NEW."B")
      WHERE id = NEW."B";
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For Extract table (parent/child relationships)
  IF TG_TABLE_NAME = 'Extract' THEN
    -- When parent changes, update both old and new parent's childCount
    IF TG_OP = 'UPDATE' AND OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      -- Update old parent if it exists
      IF OLD."parentId" IS NOT NULL THEN
        UPDATE "Extract" SET
          "childCount" = (SELECT COUNT(*) FROM "Extract" WHERE "parentId" = OLD."parentId")
        WHERE id = OLD."parentId";
      END IF;
      -- Update new parent if it exists
      IF NEW."parentId" IS NOT NULL THEN
        UPDATE "Extract" SET
          "childCount" = (SELECT COUNT(*) FROM "Extract" WHERE "parentId" = NEW."parentId")
        WHERE id = NEW."parentId";
      END IF;
    -- For INSERT/DELETE, just update the parent
    ELSIF TG_OP = 'INSERT' AND NEW."parentId" IS NOT NULL THEN
      UPDATE "Extract" SET
        "childCount" = (SELECT COUNT(*) FROM "Extract" WHERE "parentId" = NEW."parentId")
      WHERE id = NEW."parentId";
    ELSIF TG_OP = 'DELETE' AND OLD."parentId" IS NOT NULL THEN
      UPDATE "Extract" SET
        "childCount" = (SELECT COUNT(*) FROM "Extract" WHERE "parentId" = OLD."parentId")
      WHERE id = OLD."parentId";
    END IF;
  END IF;

  -- Update score for the affected extract
  IF TG_OP != 'DELETE' THEN
    UPDATE "Extract" SET
      "score" = calculate_extract_score(
        "michelinStars",
        "childCount",
        "parentId" IS NOT NULL,
        (SELECT COUNT(*) FROM "ExtractRelation" WHERE "fromId" = NEW.id),
        "spaceCount",
        "creatorCount",
        (SELECT COUNT(*) FROM "Attachment" WHERE "extractId" = NEW.id),
        "notes" IS NOT NULL,
        "sourceUrl" IS NOT NULL,
        "content" IS NOT NULL,
        EXISTS (SELECT 1 FROM "Attachment" WHERE "extractId" = NEW.id AND "caption" IS NOT NULL)
      )
    WHERE id = NEW.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update function for Space counts
CREATE OR REPLACE FUNCTION update_space_counts() RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
  total_score BIGINT;
  count_extracts BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD."B";
  ELSE
    target_id := NEW."B";
  END IF;

  SELECT COUNT(*), COALESCE(SUM(e.score), 0)
  INTO count_extracts, total_score
  FROM "_ExtractSpaces" es
  JOIN "Extract" e ON es."A" = e.id
  WHERE es."B" = target_id;

  UPDATE "Space" SET
    "extractCount" = count_extracts,
    "score" = calculate_creator_space_score(total_score, count_extracts)
  WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Update function for Creator counts
CREATE OR REPLACE FUNCTION update_creator_counts() RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
  total_score BIGINT;
  count_extracts BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD."A";
  ELSE
    target_id := NEW."A";
  END IF;

  SELECT COUNT(*), COALESCE(SUM(e.score), 0)
  INTO count_extracts, total_score
  FROM "_ExtractCreators" ec
  JOIN "Extract" e ON ec."B" = e.id
  WHERE ec."A" = target_id;

  UPDATE "Creator" SET
    "extractCount" = count_extracts,
    "score" = calculate_creator_space_score(total_score, count_extracts)
  WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add function to update linked Creator and Space scores
CREATE OR REPLACE FUNCTION update_linked_scores() RETURNS TRIGGER AS $$
DECLARE
  creator_id TEXT;
  space_id TEXT;
BEGIN
  -- Update scores for linked Creators
  FOR creator_id IN (
    SELECT "A" FROM "_ExtractCreators" WHERE "B" = NEW.id
  ) LOOP
    DECLARE
      count_extracts BIGINT;
      total_score BIGINT;
    BEGIN
      SELECT COUNT(*), COALESCE(SUM(e.score), 0)
      INTO count_extracts, total_score
      FROM "_ExtractCreators" ec
      JOIN "Extract" e ON ec."B" = e.id
      WHERE ec."A" = creator_id;

      UPDATE "Creator" SET
        "score" = calculate_creator_space_score(total_score, count_extracts)
      WHERE id = creator_id;
    END;
  END LOOP;

  -- Update scores for linked Spaces
  FOR space_id IN (
    SELECT "B" FROM "_ExtractSpaces" WHERE "A" = NEW.id
  ) LOOP
    DECLARE
      count_extracts BIGINT;
      total_score BIGINT;
    BEGIN
      SELECT COUNT(*), COALESCE(SUM(e.score), 0)
      INTO count_extracts, total_score
      FROM "_ExtractSpaces" es
      JOIN "Extract" e ON es."A" = e.id
      WHERE es."B" = space_id;

      UPDATE "Space" SET
        "score" = calculate_creator_space_score(total_score, count_extracts)
      WHERE id = space_id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for Extract
CREATE TRIGGER extract_counts_trigger
  AFTER INSERT OR UPDATE OF "parentId" OR DELETE ON "Extract"
  FOR EACH ROW
  EXECUTE FUNCTION update_extract_counts();

-- Create triggers for many-to-many relationships
CREATE TRIGGER extract_creators_trigger
  AFTER INSERT OR DELETE ON "_ExtractCreators"
  FOR EACH ROW
  EXECUTE FUNCTION update_extract_counts();

CREATE TRIGGER extract_spaces_trigger
  AFTER INSERT OR DELETE ON "_ExtractSpaces"
  FOR EACH ROW
  EXECUTE FUNCTION update_extract_counts();

CREATE TRIGGER creator_counts_trigger
  AFTER INSERT OR DELETE ON "_ExtractCreators"
  FOR EACH ROW
  EXECUTE FUNCTION update_creator_counts();

CREATE TRIGGER space_counts_trigger
  AFTER INSERT OR DELETE ON "_ExtractSpaces"
  FOR EACH ROW
  EXECUTE FUNCTION update_space_counts();

-- Create triggers for related tables
CREATE TRIGGER extract_relations_trigger
  AFTER INSERT OR DELETE ON "ExtractRelation"
  FOR EACH ROW
  EXECUTE FUNCTION update_extract_counts();

CREATE TRIGGER extract_attachments_trigger
  AFTER INSERT OR DELETE ON "Attachment"
  FOR EACH ROW
  EXECUTE FUNCTION update_extract_counts();

-- Add triggers to update Creator/Space scores when Extract scores change
CREATE TRIGGER extract_score_update_trigger
  AFTER UPDATE OF "score" ON "Extract"
  FOR EACH ROW
  WHEN (OLD.score IS DISTINCT FROM NEW.score)
  EXECUTE FUNCTION update_linked_scores();