---
name: highlight-record-editor
description: Apply formatting restoration and grammar rules to a single highlight record. Use when highlight-article-processor delegates a record for editing or when manually fixing highlight formatting.
context: fork
allowed-tools: []
---

# Highlight Record Editor

Pure transform. No tools.

## Input

```json
{
	"recordId": "<record ID>",
	"currentContent": "<plain text content>",
	"sourceExcerpt": "<markdown excerpt>",
	"articleUrl": "<source URL>",
	"isParentSummary": false
}
```

## Output

```json
{
	"recordId": "<record ID>",
	"action": "update | skip | flag",
	"content": "<formatted content if action=update>",
	"reason": "<explanation if action=skip or flag>"
}
```

## Rules

### Continuous highlight restoration

- Treat highlight as one continuous selection.
- If malformed, use first/last recognizable words to bound the selection and restore everything between.
- Do NOT restore text outside those bounds or items not selected.
- Semicolon-joined text often signals flattened lists.

### Typos and grammar

- Fix objective errors even if source has them (e.g., "shoud" -> "should", "should of" -> "should have", "there's many" -> "there are").
- Preserve jargon, UK/US spelling, and intentional style. When unsure, do not change.

### Formatting (only if present in source)

- Bold, italic, links, inline code
- Code blocks: exact bytes, preserve language tag
- Blockquotes: exact nesting
- Lists: bullets or numbered
- Never add formatting not in source

### URL cleaning (for restored links)

- Strip tracking: utm\_\*, fbclid, gclid, dclid, msclkid, twclid, igshid, ref, source, mc_cid, mc_eid, \_ga, \_gl, affiliate, partner, sessionid, si
- Keep content-affecting params: id, page, q, query, search, tab, section, anchor, required IDs/keys
- When unsure, strip

### Paragraph spacing

- Use `\n\n` between paragraphs
- Convert trailing-space line breaks (`"  \n"`) to `"\n\n"`
- Collapse 3+ newlines to 2
- Preserve whitespace inside code/pre blocks

### Platform-specific linking (by articleUrl)

- X/Twitter: @user -> https://x.com/user (no hashtags)
- Reddit: r/subreddit -> https://reddit.com/r/subreddit, u/user -> https://reddit.com/u/user

### Headings

- Convert headings to bold text only; remove `#`
- Never modify the record title

### Sentence fragments

- Default: capitalize.
- Add leading ellipsis only when clearly needed for missing referent (e.g., "which", "this/that").
- Conjunctions (So/And/But): usually keep as-is.

### Trailing punctuation

- If highlight ends with `:`, `,`, or `;`, remove it (do not replace with period).

### Footnote markers

- Strip inline footnote markers/superscripts: `^2`, `^[2]`, `[^2]`, `^a`, and bare bracketed markers like `[1]`.
- We do not capture footnote content; remove the markers entirely.

### Line-break artifacts

- Join hard line-break hyphenation: `inter-\nnational` -> `international`.
- Remove soft hyphens (`\u00ad`) and zero-width spaces.
- Collapse repeated spaces/tabs outside code/pre blocks.

### Spacing + duplicates + page artifacts

- Fix bad spacing around punctuation outside code: `word ,` -> `word,` and `word .` -> `word.`.
- Remove exact duplicate consecutive lines unless clearly intentional (e.g., poetic repetition).
- Strip standalone page/section artifacts when isolated (e.g., `Back to top`, `↑`, `↩︎`).

### Bracketed reference stubs

- Strip generic stubs like `[citation needed]`, `[source]`, `[link]` when they’re not part of the selected highlight’s meaning.

### Summary-specific (isParentSummary=true)

- Edit `summary` (not `content`).
- Fix paragraph spacing + typos/grammar.
- If summary is very long and appears copied verbatim, flag.
- No source excerpt: skip source-dependent edits (formatting, links, code).

## Decision logic

- `update` if any change (formatting, grammar, spacing, links, URL cleanup, punctuation).
- `skip` if no changes needed.
- `flag` if corrupted, cannot locate in source when source available, summary over-extracted, or change is ambiguous.
