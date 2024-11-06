import { sql } from 'drizzle-orm';
import { arcDb } from './db';

const main = () => {
	const query = sql`WITH daily_visits AS (
    SELECT 
        date(v.visit_time/1000000-11644473600, 'unixepoch', 'localtime') as visit_date,
        u.url,
        u.title,
        COUNT(*) as visit_count,
        ROUND(SUM(v.visit_duration/1000000.0), 1) as total_duration_seconds,
        GROUP_CONCAT(DISTINCT cnt.search_terms) as search_terms,
        GROUP_CONCAT(DISTINCT cnt.page_language) as page_languages,
        GROUP_CONCAT(DISTINCT cnt.related_searches) as related_searches,
        GROUP_CONCAT(DISTINCT ctx.response_code) as response_codes,
        MIN(datetime(v.visit_time/1000000-11644473600, 'unixepoch', 'localtime')) as first_visit,
        MAX(datetime(v.visit_time/1000000-11644473600, 'unixepoch', 'localtime')) as last_visit
    FROM visits v
    JOIN urls u ON v.url = u.id
    LEFT JOIN context_annotations ctx ON v.id = ctx.visit_id
    LEFT JOIN content_annotations cnt ON v.id = cnt.visit_id
    WHERE 
        u.url NOT LIKE 'chrome-extension://%'
        AND u.url NOT LIKE 'chrome://%'
        AND u.url NOT LIKE 'about:%'
    GROUP BY 
        date(v.visit_time/1000000-11644473600, 'unixepoch', 'localtime'),
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
FROM daily_visits
ORDER BY visit_date DESC, total_duration_seconds DESC;`;
	const history = arcDb.all(query);
	console.log(history);
};

main();
