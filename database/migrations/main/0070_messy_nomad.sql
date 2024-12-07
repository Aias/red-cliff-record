-- Custom SQL migration file, put your code below! --
-- Copy data from old timestamp columns to new content timestamp columns for twitter_tweets
UPDATE integrations.twitter_tweets
SET
	content_created_at = created_at
WHERE
	content_created_at IS NULL
	AND created_at IS NOT NULL;

-- Copy data for twitter_users
UPDATE integrations.twitter_users
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