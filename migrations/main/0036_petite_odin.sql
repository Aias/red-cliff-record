ALTER TABLE "predicates" ADD COLUMN "canonical" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "predicates_canonical_index" ON "predicates" USING btree ("canonical");--> statement-breakpoint
CREATE INDEX "predicates_type_canonical_index" ON "predicates" USING btree ("type","canonical");

/* 0003_refresh_predicates.sql */
BEGIN;

------------------------------------------------------------------
-- 1.  Core records (upsert)
------------------------------------------------------------------
INSERT INTO records (slug, title, type)
VALUES
  ('nick-trombley',     'Nick Trombley',     'entity'),
  ('red-cliff-record',  'Red Cliff Record',  'artifact')
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      type  = EXCLUDED.type;

------------------------------------------------------------------
-- 2.  Temporary table with current seed
------------------------------------------------------------------
CREATE TEMP TABLE _seed_predicates (
  slug          text PRIMARY KEY,
  name          text,
  type          predicate_type,   -- <── enum here
  role          text,
  inverse_slug  text,
  canonical     boolean
);

INSERT INTO _seed_predicates (slug,name,type,role,inverse_slug,canonical) VALUES
  /* ─ Creation */
  ('created_by',   'created by',   'creation', 'creator',  'creator_of',  TRUE),
  ('creator_of',   'creator of',   'creation', 'creator',  'created_by',  FALSE),
  ('via',          'via',          'creation', 'referrer', 'source_for',  TRUE),
  ('source_for',   'source for',   'creation', 'referrer', 'via',         FALSE),
  ('edited_by',    'edited by',    'creation', 'editor',   'editor_of',   TRUE),
  ('editor_of',    'editor of',    'creation', 'editor',   'edited_by',   FALSE),

  /* ─ Containment */
  ('contained_by', 'contained by', 'containment', NULL, 'contains',     TRUE),
  ('contains',     'contains',     'containment', NULL, 'contained_by', FALSE),
  ('quotes',       'quotes',       'containment', NULL, 'quoted_in',    TRUE),
  ('quoted_in',    'quoted in',    'containment', NULL, 'quotes',       FALSE),

  /* ─ Description */
  ('has_format',   'has format',   'description', NULL, 'format_of',    TRUE),
  ('format_of',    'format of',    'description', NULL, 'has_format',   FALSE),
  ('tagged_with',  'tagged with',  'description', NULL, 'tag_of',       TRUE),
  ('tag_of',       'tag of',       'description', NULL, 'tagged_with',  FALSE),

  /* ─ Reference */
  ('references',     'references',     'reference', NULL, 'referenced_by', TRUE),
  ('referenced_by',  'referenced by',  'reference', NULL, 'references',    FALSE),
  ('about',          'about',          'reference', NULL, 'subject_of',    TRUE),
  ('subject_of',     'subject of',     'reference', NULL, 'about',         FALSE),

  /* ─ Association */
  ('related_to',   'related to',   'association', NULL, 'related_to',   TRUE),

  /* ─ Identity */
  ('same_as',      'same as',      'identity',    NULL, 'same_as',      TRUE);

------------------------------------------------------------------
-- 3.  Upsert predicates from the seed
------------------------------------------------------------------
INSERT INTO predicates (slug,name,type,role,inverse_slug,canonical)
SELECT slug,name,type,role,inverse_slug,canonical   -- now already enum
FROM   _seed_predicates
ON CONFLICT (slug) DO UPDATE
  SET name         = EXCLUDED.name,
      type         = EXCLUDED.type,
      role         = EXCLUDED.role,
      inverse_slug = EXCLUDED.inverse_slug,
      canonical    = EXCLUDED.canonical;

------------------------------------------------------------------
-- 4.  Demote any row that is present but no longer canonical
------------------------------------------------------------------
UPDATE predicates p
SET canonical = FALSE
WHERE p.slug IN (
  SELECT slug FROM _seed_predicates WHERE canonical = FALSE
)
AND   p.canonical = TRUE;

------------------------------------------------------------------
-- 5.  Remove links & predicates not in seed at all
------------------------------------------------------------------
DELETE FROM links
WHERE predicate_id IN (
  SELECT id FROM predicates
  WHERE slug NOT IN (SELECT slug FROM _seed_predicates)
);

DELETE FROM predicates
WHERE slug NOT IN (SELECT slug FROM _seed_predicates);

COMMIT;