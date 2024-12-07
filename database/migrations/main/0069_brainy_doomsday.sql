-- Copy data for raindrop_raindrops
UPDATE integrations.raindrop_raindrops
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for raindrop_collections
UPDATE integrations.raindrop_collections
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for readwise_documents
UPDATE integrations.readwise_documents
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for airtable_extracts
UPDATE integrations.airtable_extracts
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for airtable_creators
UPDATE integrations.airtable_creators
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for airtable_spaces
UPDATE integrations.airtable_spaces
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);

-- Copy data for airtable_attachments
UPDATE integrations.airtable_attachments
SET
	content_created_at = created_at,
	content_updated_at = updated_at
WHERE
	(
		content_created_at IS NULL
		AND created_at IS NOT NULL
	)
	OR (
		content_updated_at IS NULL
		AND updated_at IS NOT NULL
	);