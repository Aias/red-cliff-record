---
name: highlight-article-processor
description: Process one article's highlights by fetching source and delegating edits. Use when given an article ID or when highlight-curation-queue delegates.
context: fork
allowed-tools: Bash, WebFetch, Read, Skill, Task
---

# Highlight Article Processor

Process a single article by ID. Use `rcr` only; never SQL/psql/Drizzle.

## Inputs

- articleId (required): numeric database record ID (e.g., 41593), NOT a queue index
- dryRun (optional bool): show changes only

Parse from args string: `articleId=41593` or `articleId=41593 dryRun=true`

## Workflow

1. Fetch article + links:

```bash
rcr records get <articleId> --links
```

Extract title, url, summary, content. Child highlights = `incomingLinks` where `predicate.type == "containment"`; child id = `sourceId`. Parent context = `outgoingLinks` where `predicate.type == "containment"`.

2. Fetch child highlights (batch):

```bash
rcr records get <id1> <id2> ... --raw
```

3. Fetch source (STRICT order, mandatory):

1) `rcr fetch url "<article-url>" --content-only` (MUST run first)
2) WebFetch ONLY if rcr fetch returns a non-zero exit or explicit error
3) If both fail, continue without source; mark unavailable

Hard rule: If rcr fetch succeeds, do NOT use WebFetch. If WebFetch is used without a failed rcr fetch, stop and correct (policy violation).

4. For each highlight, extract source excerpt:

- Find highlight text in source; include ~300-500 chars before/after with structural context.
- If malformed/concatenated, use first/last recognizable words to bound and extract the full section.

5. Attach associated media (if clearly tied to a highlight):
   - Detect media in source/excerpt: markdown images `![]()`, `<img>`, `<video>`, `<source src>`, or obvious media URLs (.png/.jpg/.gif/.webp/.mp4/.webm/.mov).
   - Resolve relative URLs against the article URL before upload.
   - Upload + link to the highlight record via CLI (tRPC):

```bash
rcr media create --record <highlightId> --url "<media-url>"
```

   - `media create` triggers best-effort alt for images; only force if still null or you need it immediately.
   - If media is an image and `altText` is still null after create, run:

```bash
rcr media generate-alt <mediaId> --force
```

   - For non-image media, set a short descriptive alt text:

```bash
rcr media update <mediaId> '{"altText": "Short description"}'
```

6. Process parent summary (REQUIRED):
   Invoke `highlight-record-editor` with `isParentSummary=true`. Provide current summary; no source excerpt. Fix trailing-space line breaks (`"  \n" -> "\n\n"`).

Skill tool params:

- skill: highlight-record-editor
- args: "recordId=<articleId> articleUrl=<url> isParentSummary=true"

7. Process highlights with a capped parallel pool (max 5 at a time):
   - Create tasks for each highlight; keep at most 5 running.
   - As each completes, launch the next until all are done.
   - Each task must invoke `highlight-record-editor` with `isParentSummary=false`.

Task prompt (per highlight):
```
Use Skill tool to invoke highlight-record-editor with:
recordId=<id>
currentContent=<content>
sourceExcerpt=<excerpt>
articleUrl=<url>
isParentSummary=false
```

8. Collect results from all tasks (update/skip/flag).

9. Apply updates (unless dryRun):

```bash
rcr records update <id> '{"content": "..."}'
```

For quotes/special chars, use heredoc:

```bash
rcr records update <id> <<'EOF'
{"content": "..."}
EOF
```

If dryRun: show diffs; do not write.

**Important**: Do NOT mark the article record as curated (`isCurated: true`). This workflow only formats highlight content and summaries. The `isCurated` field should remain unchanged.

10. Return summary JSON:

```json
{
	"articleId": "<id>",
	"articleTitle": "<title>",
	"sourceStatus": "fetched | unavailable",
	"highlightsProcessed": 8,
	"highlightsUpdated": 5,
	"highlightsSkipped": 2,
	"highlightsFlagged": 1,
	"flaggedIds": ["<id>"]
}
```

## Errors

- Source unavailable: continue; flag in summary.
- Highlight not found in source: process without source; flag.
- Corrupted content: skip; flag for review.
- Update failed: report error; continue.
