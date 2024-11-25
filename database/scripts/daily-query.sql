WITH
	combined_activities AS (
		SELECT
			bh.view_time AS timestamp,
			'Browsing History' AS activity_type,
			bh.page_title AS title,
			bh.url AS url,
			NULL AS main_content,
			NULL AS creator,
			NULL AS tags
		FROM
			arc.browsing_history bh
		UNION ALL
		SELECT
			c.commit_date AS timestamp,
			'GitHub Commit' AS activity_type,
			c.message AS title,
			c.url AS url,
			STRING_AGG (CONCAT (cc.filename, ': ', cc.patch), '\n') AS main_content,
			c.committer AS creator,
			NULL AS tags
		FROM
			github.commits c
			JOIN github.commit_changes cc ON c.id = cc.commit_id
		GROUP BY
			c.commit_date,
			c.message,
			c.url,
			c.committer
		UNION ALL
		SELECT
			s.starred_at AS timestamp,
			'GitHub Star' AS activity_type,
			s.name AS title,
			s.repo_url AS url,
			s.description AS main_content,
			s.owner_login AS creator,
			array_to_string (s.topics, ', ') AS tags
		FROM
			github.stars s
		UNION ALL
		SELECT
			r.created_at AS timestamp,
			'Raindrop' AS activity_type,
			r.title AS title,
			r.link_url AS url,
			r.excerpt AS main_content,
			NULL AS creator,
			array_to_string (r.tags, ', ') AS tags
		FROM
			raindrop.raindrops r
			LEFT JOIN raindrop.collections c ON r.collection_id = c.id
		UNION ALL
		SELECT
			d.saved_at AS timestamp,
			'Readwise Document' AS activity_type,
			d.title AS title,
			d.url AS url,
			COALESCE(d.summary, '') || ' ' || COALESCE(d.content, '') || ' ' || COALESCE(d.notes, '') AS main_content,
			d.author AS creator,
			array_to_string (d.tags, ', ') AS tags
		FROM
			readwise.documents d
		UNION ALL
		SELECT
			t.posted_at AS timestamp,
			'Twitter Tweet' AS activity_type,
			NULL AS title,
			NULL AS url,
			t.text AS main_content,
			u.display_name AS creator,
			NULL AS tags
		FROM
			twitter.tweets t
			LEFT JOIN twitter.users u ON t.user_id = u.id
	)
SELECT
	*
FROM
	combined_activities
WHERE
	timestamp >= CURRENT_DATE - INTERVAL '1 day'
	AND timestamp < CURRENT_DATE
ORDER BY
	timestamp;

/*
DAILY SUMMARY PROMPT:

# Daily Activity Summary Guidelines

I'm going to copy a number of different data sources gathered throughout my day. I'd like you to summarize my day in a linear fashion based on the following focus areas and guidelines.

## Primary Focus

### 1. Technical Work & Engineering

- Code, commits, infrastructure.
- Database work and system architecture.
- Front end and design.

Pay close attention to specific tools and technologies, such as frameworks, integrations, or packages that might be included in a package.json. If these can be inferred from context include those as well.

### 2. Design & Creative

- Assets, mockups, or other design artifacts, especially work in Figma or other design tools.
- User experience research or other activity.
- Visual design.
- Creative strategy, design systems, and other design work.

### 3. Learning & Professional Development

- Technical reading.
- Industry analysis.
- Academic research, especially in: 
- Design
- Engineering
- AI
- Math
- Science
- Code
- Philosophy
- Economics
- Art
- Literature
- Tools and methodologies.

### 4. Industry Commentary & Analysis

- Professional critiques (even if humorous).
- Design/tech industry trends and notable events.
- Engineering/design/tech culture, process, or theory.

## Include Only When Professionally Relevant

- Social media discussions about design, technology, or industry practices.
- Notable examples of novelty, success, failure, or other historically relevant context in the above focus areas.
- Interesting tools or methodologies mentioned in casual contexts.

## Exclude Unless Exceptionally Relevant

- Politics and other culturally divisive topics (unless directly impacting tech/design industry).
- Personal activities.
- Entertainment.
- General news.

## Data Format

The data will be provided after these instructions in the form of a delimited SQL query result with headers the following headers in this order: timestamp, activity_time, title, url, main_content, creator, tags. The main_content field can be quite long and contain its own delimiters and line breaks and data formatting, so pay close attention to context to determine where the next daily history item begins.

Please provide a chronological summary that captures the key activities and learnings from the day, organizing them according to the focus areas above while maintaining readability and narrative flow.

## Data Sources

The following data sources are included, in descending order of importance.
- **Github**: Starred repositories, commits, and files changed along with the first 1000 characters of each change
- Raindrop: Bookmarked links with tags and categories
- Readwise: Longer form reading and highlights from those articles
- Arc: Browser history summarized by URL and time spent at each unique one throughout the course of the day
- Twitter: Recent bookmarks. These may have been posted in the past but bookmarked today

If additional context is needed to supplement the provided data, feel free to search the web.

## Stylistic Instructions

- Typographically, write in short sentences arranged into brief paragraphs, interspersed with bulleted or numbered lists when appropriate.
- Keep it factual and straightforward without value interpretation.
- Do not use headings, but you may use bold or italics to call attention to certain sections or especially relevant information.
- Write in a generic tense, avoiding both usage of "you" or "I", for example, rather than "I wrote code for a new module" or "You wrote code for a new module", simply say "Wrote code for a new module."
- If any links, articles, documents, or repos are mentioned, link to them using a [markdown-formatted link](https://example.com) and cite the author if possible. Reference them inline where they are discussed/summarized, not in a separate section at the end.
- Output only the summary, no preamble, postscript, or meta-commentary. Assume the output will be used as-is.

## Final Notes

The goal is to create a kind of "learning log" that a professional might publish, focusing on work, creativity, tools, technologies, and industry developments.

Finally, aim to be comprehensive, somewhere between 750 and 1000 words, but don’t force it if there isn’t enough content to be relevant.

---

<START_DAILY_DATA>
 */