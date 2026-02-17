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
- **Adaptive K-factor:** K=32 for records with <10 matchups, K=24 for 10–30, K=16 for 30+. New records move fast through the ranks; established records stabilize.
- Scores are unbounded but will naturally cluster around 800–1600 in practice.

### Matchups

A **matchup** is a head-to-head comparison: the user sees two records of the same type and picks the more important/valuable one (or declares a draw).

**Storage:** Each matchup is persisted so we have a full comparison history:

| Field       | Type      | Description                          |
| ----------- | --------- | ------------------------------------ |
| `id`        | serial    | Primary key                          |
| `recordA`   | int (FK)  | First record                         |
| `recordB`   | int (FK)  | Second record                        |
| `winner`    | int? (FK) | Winning record (null = draw)         |
| `recordType`| text      | Record type for this matchup         |
| `createdAt` | timestamp | When the comparison was made         |

After each matchup, both records' ELO scores are updated in place.

## Ranking Interactions

### Contextual Matchups (Relations Sidebar)

The **primary everyday interaction** with the ELO system. When viewing a record, the existing relations sidebar is expanded to include a small matchup section showing a few randomly selected opponents near the current record's ELO (same type). The user can tap one to declare a winner, and both records' scores update immediately.

**Why this matters:** Most curation happens while you're already looking at a record — reading its content, editing its metadata, reviewing its links. Embedding matchups in that context means ranking is a natural side-effect of curation rather than a separate chore. New records and records being actively curated will naturally accumulate matchups and settle into the right rank without the user ever visiting a dedicated ranking page.

**Behavior:**
- Show 2–3 opponent cards in the sidebar, drawn from records with similar ELO (±200) and the same type.
- Each card shows the opponent's title, avatar, and current ELO.
- Each opponent card has two buttons: **thumbs up** (current record wins) and **thumbs down** (opponent wins). Explicit, no ambiguity about which direction the comparison goes.
- After a matchup, the resolved opponent is replaced with a new one, so the user can keep going or stop at any time.
- If the current record has very few matchups, bias opponent selection toward well-established records (high matchup count) to anchor the new record faster.

**UI location:** Below the existing relations/links in the sidebar, under a "Rank" or "Compare" heading.

## Other Ranking Modes

### 1. Seed from Stars (Migration)

One-time conversion of existing star ratings into initial ELO scores:

| Stars | Initial ELO |
| ----- | ----------- |
| 0     | 1000        |
| 1     | 1200        |
| 2     | 1400        |
| 3     | 1600        |

This gives starred records a head start without requiring the user to re-rank everything from scratch. The spread (200 points per star) is wide enough to be meaningful but narrow enough that a few matchups can overturn a bad seed.

### 2. Random Matchups ("Arena" Mode)

A dedicated page/panel where the user is shown two random records of the same type and picks a winner.

**Pair selection heuristic:**
- Prefer records with similar ELO scores (within ±200) — these are the most informative comparisons.
- Prefer records with fewer total matchups (under-ranked records surface first).
- Occasionally surface a wild-card pair (large ELO gap) to catch misranked outliers.

**UI sketch:**
```
┌─────────────────┐   VS   ┌─────────────────┐
│   Record A      │        │   Record B      │
│   (ELO: 1340)   │        │   (ELO: 1280)   │
│   [Pick]        │        │   [Pick]        │
└─────────────────┘        └─────────────────┘
                  [ Draw ]
                  [ Skip ]
```

The user can grind through as many matchups as they want in a session, or stop at any time. Each comparison incrementally improves the ranking quality.

### 3. Settle Mode ("Rank This Record")

When viewing a specific record, the user can trigger a **settle** flow that quickly finds the record's correct rank through a sequence of targeted matchups.

**Algorithm:**
1. Start by matching the record against an opponent near the median ELO for its type.
2. If the record wins, next opponent is higher-ELO; if it loses, lower-ELO.
3. Binary-search pattern: opponent ELO range narrows each round.
4. Stop when the record's ELO change from the last matchup is below a threshold (e.g., < 5 points), or after a maximum number of rounds (e.g., 7).

This lets a user quickly slot a new or re-evaluated record into the right tier without grinding through random matchups.

## Schema Changes

### New columns on `records`

```
eloScore     integer  NOT NULL  DEFAULT 1200
eloMatchups  integer  NOT NULL  DEFAULT 0     -- total matchups participated in
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

The `rating` column stays in the schema during migration but is no longer written to or read from by the application. It can be dropped in a future migration after the ELO system is validated.

## API Surface

### tRPC Mutations

- `elo.submitMatchup({ winnerId, loserId } | { drawIds: [id, id] })` — Record a matchup result, update ELO scores, return new scores.

### tRPC Queries

- `elo.getRandomMatchup({ recordType })` — Returns a pair of records for arena mode.
- `elo.getSettleOpponent({ recordId })` — Returns the next opponent for settle mode (binary-search logic).
- `elo.getLeaderboard({ recordType, limit?, offset? })` — Paginated list of records ordered by ELO score.

### Existing API Changes

- Record list/grid endpoints: replace `rating` sort/filter with `eloScore` equivalents.
- Record detail: expose `eloScore` and `eloMatchups` count.
- CLI `rcr records list`: replace `--rating-min/max` with `--elo-min/max`, add `--order=elo:desc`.

## UI Changes

### Record Grid/List

- Replace star display with raw ELO score (e.g., `1340`).
- No tier abstraction — the number itself is the display.

### Record Detail / Relations Sidebar

- Remove star slider.
- Show current ELO score and matchup count.
- Add contextual matchup section to the relations sidebar (2–3 opponent cards, inline win/loss actions).
- "Rank this" button launches settle mode for more deliberate positioning.

### New: Arena Page

- Accessible from main nav or records section.
- Record type selector (entity / concept / artifact / all).
- Matchup card UI as sketched above.
- Session stats: matchups completed this session, records ranked.

## Integration Mapping

Current integrations map external signals to the 0–3 star scale. Under ELO:

- **New records from integrations** get the default ELO (1200). External importance signals (Readwise stars, Raindrop important flag, Airtable michelin stars, Adobe ratings) are mapped to seed ELOs using the same star→ELO table from the migration.
- Integration re-syncs do **not** overwrite ELO scores — once a record has matchup history, its ELO is user-sovereign.

## Migration Plan

1. Add `eloScore` and `eloMatchups` columns to `records`.
2. Backfill `eloScore` from existing `rating` values using the seed table.
3. Create `elo_matchups` table.
4. Update application code: queries, mutations, UI.
5. Remove star-related UI and filters.
6. Keep `rating` column for rollback safety; drop in a later migration.

## Decisions

- **K-factor:** Adaptive. K=32 (<10 matchups), K=24 (10–30), K=16 (30+).
- **Sidebar interaction:** Thumbs up / thumbs down buttons on each opponent card. No ambiguity.
- **Score display:** Raw numbers everywhere. No tier abstraction.
- **Arena page:** Yes, build as a dedicated page.
- **Cross-type comparison:** No. Each type is its own league.

## Open Questions

- **Decay:** Should ELO scores decay over time if a record hasn't been in a matchup recently? Could help surface stale rankings for re-evaluation.
- **Bulk seeding UI:** For users with large existing collections, should there be a guided "seed session" that walks through the most impactful matchups first?
