---
name: highlight-curation-queue
description: Queue and batch-process uncurated Readwise articles for highlight formatting. Use when user mentions curation, uncurated records, highlight queue, or processing highlights.
context: fork
allowed-tools: Bash, Task
---

# Highlight Curation Queue

Batch discovery and processing for uncurated Readwise articles. Use `rcr` only.

## Workflow

1. Find candidates:

```bash
rcr records list --type=artifact --curated=false --has-title --limit=10 --raw
```

- `--limit=N` if user specifies
- Add `--source=<name>` if user wants a source filter
- Records without highlights may be skipped later

2. Present candidates:
   Show as a markdown table with columns: `#` (1-indexed), `ID` (record ID), `Title`, `URL`.
   Ask for selection: all, indices (e.g., "1,3,5"), or record IDs directly.

3. Map selection to record IDs:

- "all" -> all record IDs from candidate list
- "1,3,5" -> map 1-indexed positions to record IDs from candidate list
- Record IDs provided directly -> use as-is
- If IDs provided up front, skip discovery

**Critical**: User indices (1, 2, 3...) are 1-indexed positions in the displayed list, NOT record IDs. You must look up the actual record ID for each selected index before delegating.

4. Delegate in parallel:
   For each **record ID** (not index), spawn a Task subagent:

Task tool params:

- subagent_type: general-purpose
- prompt: "Use Skill tool to invoke highlight-article-processor with args 'articleId=<RECORD_ID>'" where <RECORD_ID> is the actual numeric database ID (e.g., 41593), never a list index.

Run all Task calls in parallel (single response with multiple Task tool calls).

5. Post-processing:

- Regenerate embeddings: `rcr sync embeddings`
- Summarize results: records processed, highlights updated, flagged for review
- **Do NOT mark articles as curated**: This workflow only formats highlight content. Never update `isCurated` field on article records.
