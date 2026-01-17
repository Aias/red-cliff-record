# Plan: LLM-based Record Text Cleaning

## Overview

Add a `records.clean` procedure that uses GPT-5.2 to lightly edit record text fields (summary, content, notes) while preserving stylistic intent. Accessible via tRPC (frontend) and CLI.

## User Requirements

- Clean: paragraph spacing (single → double newlines), missing sentence spaces, whitespace issues
- Fix obvious spelling/capitalization mistakes (NOT stylistic ones)
- Use parent + siblings for context to understand stylistic choices
- Do NOT touch title
- Be very conservative - leave most content unchanged
- `--dry-run` flag for preview without applying

## Files to Create

### 1. `src/server/api/routers/records/clean.ts` (new)

Core tRPC procedure following the `embed.ts` pattern:

```
- Input: { id: number, dryRun?: boolean }
- Fetch record with parent + siblings via nested relational query
- Build context string with parent/sibling titles + summaries
- Call GPT-5.2 using openai.responses.create() pattern from summarize-commits.ts
- Return { id, fieldsChanged, original, cleaned, applied }
- If !dryRun && fieldsChanged: update DB, set textEmbedding: null
```

Schema for LLM output:

```typescript
const CleanedFieldsSchema = z.object({
  summary: z.string().nullable(),
  content: z.string().nullable(),
  notes: z.string().nullable(),
});
```

## Files to Modify

### 2. `src/server/api/routers/records/index.ts`

Add import and register:

```typescript
import { clean } from './clean';
// ...
export const recordsRouter = createTRPCRouter({
  // ...existing...
  clean,
});
```

### 3. `src/server/cli/rcr/commands/records.ts`

Add CLI handler following `embed` pattern:

```typescript
const RecordsCleanOptionsSchema = BaseOptionsSchema.extend({
  'dry-run': z.boolean().optional(),
}).strict();

export const clean: CommandHandler = async (args, options) => {
  // parseIds, call caller.records.clean, return success
};
```

### 4. `src/server/cli/rcr/index.ts`

Update HELP_TEXT to include:

```
records clean <id...>        Clean record text using LLM [--dry-run]
```

## Key Patterns to Follow

**OpenAI call** (from `summarize-commits.ts:98-116`):

```typescript
const response = await openai.responses.create({
  model: 'gpt-5.2',
  instructions: CLEANING_INSTRUCTIONS,
  text: {
    format: {
      type: 'json_schema',
      name: 'cleaned_record_fields',
      schema: z.toJSONSchema(CleanedFieldsSchema),
      strict: true,
    },
  },
  input: [{ role: 'user', content: contextString }],
});
```

**Context fetching** (simplified from `tree.ts`):

- Fetch via outgoingLinks → predicate.type='containment' → target (parent)
- Parent's incomingLinks → source (siblings, exclude self)

## LLM Prompt Structure

```
Instructions:
- Conservative text editor rules
- DO NOT change stylistic spelling/capitalization
- Rules for paragraph spacing, sentence spacing, whitespace

Input:
## Context
### Parent Record
Title: ...
Summary: ...

### Sibling Records (up to 5)
- Title1: Summary1
- Title2: Summary2

## Record to Clean
Title (DO NOT MODIFY): ...
summary: "..."
content: "..."
notes: "..."
```

## Implementation Order

1. Create `clean.ts` with procedure
2. Register in `records/index.ts`
3. Add CLI handler in `commands/records.ts`
4. Update help text in `cli/rcr/index.ts`
5. Test with dry-run first
