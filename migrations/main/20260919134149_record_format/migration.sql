ALTER TABLE "records" ADD COLUMN "format_id" integer;--> statement-breakpoint
CREATE INDEX "records_format_id_index" ON "records" ("format_id");--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_format_id_records_id_fkey" FOREIGN KEY ("format_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
WITH format_counts AS (
  SELECT target_id, count(*) AS n
  FROM links
  WHERE predicate = 'has_format'
  GROUP BY target_id
),
ranked AS (
  SELECT l.source_id, l.target_id, c.n,
    row_number() OVER (PARTITION BY l.source_id ORDER BY c.n, l.target_id) AS rank
  FROM links l
  JOIN format_counts c ON c.target_id = l.target_id
  WHERE l.predicate = 'has_format'
)
UPDATE records r
SET format_id = ranked.target_id
FROM ranked
WHERE ranked.source_id = r.id AND ranked.rank = 1;--> statement-breakpoint
WITH format_counts AS (
  SELECT target_id, count(*) AS n
  FROM links
  WHERE predicate = 'has_format'
  GROUP BY target_id
),
ranked AS (
  SELECT l.source_id, l.target_id, c.n,
    row_number() OVER (PARTITION BY l.source_id ORDER BY c.n, l.target_id) AS rank
  FROM links l
  JOIN format_counts c ON c.target_id = l.target_id
  WHERE l.predicate = 'has_format'
)
UPDATE records specific
SET format_id = general.target_id
FROM ranked chosen
JOIN ranked general ON general.source_id = chosen.source_id AND general.rank = 2
WHERE chosen.rank = 1
  AND specific.id = chosen.target_id
  AND specific.format_id IS NULL
  AND general.n >= 3 * chosen.n;--> statement-breakpoint
UPDATE records r
SET format_id = f.record_id
FROM airtable_extracts e
JOIN airtable_formats f ON f.id = e.format_id
WHERE e.record_id = r.id
  AND r.format_id IS NULL
  AND f.record_id IS NOT NULL;--> statement-breakpoint
DELETE FROM links WHERE predicate IN ('has_format', 'format_of');
