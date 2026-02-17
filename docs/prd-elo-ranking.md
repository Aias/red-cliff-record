# PRD: ELO Ranking System

**Status:** Draft
**Date:** 2026-02-17
**Replaces:** Star rating system (0–3 `rating` field on records)

## Problem

The current star system (0–3) is too coarse to express meaningful relative importance across a growing collection. Three tiers can't distinguish between, say, a foundational text and a merely good one — both end up at ⭐⭐⭐. The result is that "top tier" becomes a dumping ground and the rating loses signal over time.

## Proposal

Replace star ratings with an **ELO-based ranking system**, scoped per record type (`entity`, `concept`, `artifact`). Records earn their rank through head-to-head comparisons rather than absolute labels.

## Core Concepts

### ELO Scores

- Each record gets an `eloScore` (integer, default 1200).
- Scores are scoped by record type — an artifact's ELO is only meaningful relative to other artifacts.
- **Adaptive K-factor:** Each record uses its own K based on its own matchup count (asymmetric updates, standard ELO practice). K=32 for records with <10 matchups, K=24 for 10–30, K=16 for 30+. New records move fast through the ranks; established records stabilize.
- Scores are truly unbounded — no floor or ceiling. They will naturally cluster around 800–1600 in practice.
- Draws are valid outcomes and split points per standard ELO calculation. Both draws and decisive outcomes increment each record's `eloMatchups` counter. Skips do not.

### Matchups

A **matchup** is a head-to-head comparison: the user sees two records of the same type and picks the more important/valuable one, declares a draw, or skips.

**Outcomes:**

- **Win/Loss:** Winner gains points, loser loses points (asymmetric K per record).
- **Draw:** Points are split per standard ELO formula. Both records' `eloMatchups` counters increment.
- **Skip:** No ELO change, no matchup recorded. The opponent is replaced with a new one.

**Storage:** Each matchup (except skips) is persisted for history. Matchup history is not surfaced in the UI — it's fire-and-forget from the user's perspective; only the resulting score matters.

| Field        | Type      | Description                                                                              |
| ------------ | --------- | ---------------------------------------------------------------------------------------- |
| `id`         | serial    | Primary key                                                                              |
| `recordA`    | int (FK)  | First record                                                                             |
| `recordB`    | int (FK)  | Second record                                                                            |
| `winner`     | int? (FK) | Winning record (null = draw)                                                             |
| `recordType` | text      | Denormalized for query performance and historical correctness if a record's type changes |
| `createdAt`  | timestamp | When the comparison was made                                                             |

After each matchup, both records' ELO scores are updated in place.

**Deletion behavior:** When a record is deleted, its matchup rows cascade-delete. The opponent's ELO is **not** retroactively recalculated — ELO is a running tally; history is not rewritten.

**Consistency:** ELO handles transitive cycles (A > B > C > A) naturally through score adjustments. No cycle detection or prevention logic.

**Cross-type constraint:** Matchups between records of different types are rejected at the server level (tRPC validation). Each type is its own league.

## Ranking Interactions

### Contextual Matchups (Relations Sidebar)

The **primary everyday interaction** with the ELO system. When viewing a record, the existing relations sidebar includes a collapsible matchup section showing a few randomly selected opponents. The user can tap one to declare a winner, and both records' scores update immediately with a brief delta animation (e.g., `+18`).

**Why this matters:** Most curation happens while you're already looking at a record — reading its content, editing its metadata, reviewing its links. Embedding matchups in that context means ranking is a natural side-effect of curation rather than a separate chore.

**Behavior:**

- Show 2–3 opponent cards in the sidebar, using the established sidebar record card pattern.
- Each opponent card has two buttons: **thumbs up** (current record wins) and **thumbs down** (opponent wins). Explicit, no ambiguity about which direction the comparison goes.
- After a matchup, the resolved opponent is replaced with a new one, so the user can keep going or stop at any time.
- A **refresh/shuffle button** lets the user get new opponents without completing a matchup.
- Score delta is shown briefly after each matchup (e.g., `1200 → 1218`) then settles to the new score.
- The section is **collapsible**, with collapsed state persisted in localStorage.

**Opponent selection:**

- Default: records with similar ELO (±200), same type. If fewer than 2–3 candidates exist in that window, widen until enough opponents are found.
- If the current record has <10 matchups (`eloMatchups < 10`), bias selection toward well-established records (high matchup count) to anchor the new record faster.

**UI location:** Below the existing relations/links in the sidebar, under a "Rank" or "Compare" heading.

### Focused Burst ("Rank This")

A focused matchup mode for quickly triangulating a record's position. Accessible from:

- **Record detail sidebar** — "Rank this" button.
- **Arena page** — search for a record to focus on.

**How it differs from normal matchups:** Opponents are deliberately picked across the full ELO spectrum (not just ±200) to triangulate the record's position quickly. One side of the comparison is always locked to the focused record.

This is **not** a convergence algorithm that "stops" — ranking is perpetual, just as chess players can always play new opponents. The focused burst is simply a convenient way to run a series of informative matchups for one record.

### Arena Mode

A dedicated page where the user is shown two records of the same type and picks a winner.

**Pair selection heuristic:**

- Prefer records with similar ELO scores (within ±200) — these are the most informative comparisons.
- Prefer records with fewer total matchups (under-ranked records surface first).
- Occasionally surface a wild-card pair (large ELO gap) to catch misranked outliers.

**Arena features:**

- Record type selector (entity / concept / artifact).
- Optional filters (date range, tags, subtype) to narrow the matchup pool. Filters reset each session — arena is meant to be serendipitous.
- ELO scores are **hidden** before the user picks to avoid anchoring bias.
- Draw and skip buttons available on every matchup.
- Search to focus on a specific record (enters focused burst mode, locking one side).
- Session stats: matchups completed this session, records ranked.

**UI sketch:**

```
┌─────────────────┐   VS   ┌─────────────────┐
│   Record A      │        │   Record B      │
│                 │        │                 │
│   [Pick]        │        │   [Pick]        │
└─────────────────┘        └─────────────────┘
                  [ Draw ]
                  [ Skip ]
```

## Schema Changes

### New columns on `records`

```
eloScore     integer  NOT NULL  DEFAULT 1200
eloMatchups  integer  NOT NULL  DEFAULT 0     -- total matchups participated in (wins + losses + draws, not skips)
```

### New table: `elo_matchups`

```
id           serial   PRIMARY KEY
record_a_id  integer  NOT NULL  REFERENCES records(id) ON DELETE CASCADE
record_b_id  integer  NOT NULL  REFERENCES records(id) ON DELETE CASCADE
winner_id    integer            REFERENCES records(id) ON DELETE SET NULL
record_type  text     NOT NULL
created_at   timestamp NOT NULL DEFAULT now()
```

### Deprecation of `rating`

Clean break: the `rating` column is dropped and all star-related UI, filters, and CLI flags are removed. Stars are gone from all interfaces once ELO ships.

## API Surface

### tRPC Mutations

- `elo.submitMatchup({ winnerId, loserId } | { drawIds: [id, id] })` — Record a matchup result, update ELO scores, return new scores. Server-side validation rejects cross-type matchups.

### tRPC Queries

- `elo.getMatchup({ recordType, focusRecordId? })` — Returns a pair of records. Without `focusRecordId`: random pair per arena heuristic. With `focusRecordId`: opponent selected across the full ELO spectrum for triangulation (focused burst mode).
- `elo.getLeaderboard({ recordType, limit?, offset?, minMatchups? })` — Paginated list of records ordered by ELO score. Optional `minMatchups` filter to hide unranked records.

### Existing API Changes

- Record list/grid endpoints: replace `rating` sort/filter with `eloScore` equivalents.
- Record detail: expose `eloScore` and `eloMatchups` count.
- CLI `rcr records list`: replace `--rating-min/max` with `--elo-min/max`, add `--order=elo:desc`.
- Cache invalidation: matchup mutations follow existing tRPC optimistic mutation and invalidation patterns.

## UI Changes

### Record Grid/List

- Replace star display with raw ELO score (e.g., `1340`).
- No tier abstraction — the number itself is the display.

### Record Detail / Relations Sidebar

- Remove star slider.
- Show current ELO score and matchup count.
- Add collapsible contextual matchup section to the relations sidebar (2–3 opponent cards using established sidebar card pattern, inline win/loss/skip actions, refresh button).
- "Rank this" button launches focused burst mode.

### New: Arena Page

- Accessible from main nav or records section.
- Full arena mode UI as described above.

## Integration Mapping

Current integrations map external signals to the 0–3 star scale. Under ELO:

- **New records from integrations** get the default ELO (1200). External importance signals (Readwise stars, Raindrop important flag, Airtable michelin stars, Adobe ratings) are mapped to seed ELOs using the same star→ELO table from the migration.
- **ELO is always user-sovereign.** Integration re-syncs never overwrite ELO scores, regardless of whether the record has matchup history. Once created, ELO is controlled exclusively through matchups.

## Migration Plan

1. Add `eloScore` and `eloMatchups` columns to `records`.
2. Backfill `eloScore` from existing `rating` values using the seed table (below). Set `eloMatchups` to 3 for all seeded records to slightly dampen initial volatility while still allowing fast movement.
3. Create `elo_matchups` table.
4. Update application code: queries, mutations, UI.
5. Remove star-related UI, filters, and CLI flags. Drop the `rating` column.

### Seed Table

| Stars | Initial ELO | Initial eloMatchups |
| ----- | ----------- | ------------------- |
| 0     | 1000        | 3                   |
| 1     | 1200        | 3                   |
| 2     | 1400        | 3                   |
| 3     | 1600        | 3                   |

The spread (200 points per star) is wide enough to be meaningful but narrow enough that a few matchups can overturn a bad seed. The phantom matchup count of 3 means seeded records start with K=32 but aren't quite as volatile as truly fresh records.

## Decisions

- **K-factor:** Adaptive, per-record (asymmetric). K=32 (<10 matchups), K=24 (10–30), K=16 (30+).
- **Score bounds:** Unbounded. No floor or ceiling.
- **Draws:** Supported. Split points per standard ELO. Increment matchup counters.
- **Skips:** Supported. No ELO change, no matchup recorded, opponent replaced.
- **Sidebar interaction:** Thumbs up / thumbs down buttons on each opponent card. Refresh button for new opponents. Collapsible with persistent state.
- **Score display:** Raw numbers everywhere. No tier abstraction. Brief delta animation after matchups.
- **Arena page:** Dedicated page. Scores hidden before pick. Optional filters (reset per session). Search to focus on a specific record.
- **Focused burst:** Opponents across full ELO spectrum. No convergence endpoint — ranking is perpetual.
- **Cross-type comparison:** No. Server-side validation rejects cross-type matchups.
- **Deletion:** Cascade-delete matchup rows. No retroactive recalculation of opponent scores.
- **Cycles:** No detection or prevention. ELO handles them naturally.
- **Decay:** No score decay. Matchup selection biases toward records that haven't been compared recently.
- **Integration sovereignty:** ELO is always user-sovereign. Re-syncs never overwrite, even for zero-matchup records.
- **Seeding:** Stars→ELO via migration table. `eloMatchups` set to 3 for seeded records.
- **New records:** No ranking nudge on creation. Records sit at 1200 until organically encountered.
- **API consolidation:** Single `getMatchup` endpoint with optional `focusRecordId` param instead of separate random/settle queries.
- **Matchup history:** Not surfaced in UI. Fire-and-forget; only scores matter.
- **Opponent window fallback:** If <3 candidates within ±200 ELO, widen window until enough are found.
