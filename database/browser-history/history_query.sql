SELECT
	datetime (
		(v.visit_time / 1000000 -11644473600),
		'unixepoch',
		'localtime'
	) as visit_instant,
	v.id as visit_id,
	u.url as url,
	u.title as title,
	v.from_visit as from_visit_id,
	v.opener_visit as opener_visit_id,
	ROUND(v.visit_duration / 1000000.0, 1) as visit_duration_seconds,
	ROUND(ctx.duration_since_last_visit / 1000000.0, 1) as duration_since_last_visit_seconds,
	ctx.response_code as response_code,
	v.external_referrer_url as external_referrer_url,
	cnt.related_searches as related_searches,
	cnt.search_terms as search_terms,
	cnt.page_language as page_language
FROM
	visits v
	JOIN urls u ON v.url = u.id
	LEFT JOIN context_annotations ctx ON v.id = ctx.visit_id
	LEFT JOIN content_annotations cnt ON v.id = cnt.visit_id
WHERE
	u.url NOT LIKE 'chrome-extension://%'
	AND u.url NOT LIKE 'chrome://%'
	AND u.url NOT LIKE 'about:%'
ORDER BY
	v.visit_time DESC;

WITH
	daily_visits AS (
		SELECT
			date (
				v.visit_time / 1000000 -11644473600,
				'unixepoch',
				'localtime'
			) as visit_date,
			u.url,
			u.title,
			COUNT(*) as visit_count,
			ROUND(SUM(v.visit_duration / 1000000.0), 1) as total_duration_seconds,
			GROUP_CONCAT (DISTINCT cnt.search_terms) as search_terms,
			GROUP_CONCAT (DISTINCT cnt.page_language) as page_languages,
			GROUP_CONCAT (DISTINCT cnt.related_searches) as related_searches,
			GROUP_CONCAT (DISTINCT ctx.response_code) as response_codes,
			MIN(
				datetime (
					v.visit_time / 1000000 -11644473600,
					'unixepoch',
					'localtime'
				)
			) as first_visit,
			MAX(
				datetime (
					v.visit_time / 1000000 -11644473600,
					'unixepoch',
					'localtime'
				)
			) as last_visit
		FROM
			visits v
			JOIN urls u ON v.url = u.id
			LEFT JOIN context_annotations ctx ON v.id = ctx.visit_id
			LEFT JOIN content_annotations cnt ON v.id = cnt.visit_id
		WHERE
			u.url NOT LIKE 'chrome-extension://%'
			AND u.url NOT LIKE 'chrome://%'
			AND u.url NOT LIKE 'about:%'
		GROUP BY
			date (
				v.visit_time / 1000000 -11644473600,
				'unixepoch',
				'localtime'
			),
			u.url,
			u.title
	)
SELECT
	visit_date,
	url,
	title,
	visit_count,
	total_duration_seconds,
	search_terms,
	page_languages,
	related_searches,
	response_codes,
	first_visit,
	last_visit
FROM
	daily_visits
ORDER BY
	visit_date DESC,
	total_duration_seconds DESC;