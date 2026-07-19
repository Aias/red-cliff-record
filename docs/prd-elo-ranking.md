# PRD: ELO Ranking System

**Status:** Final
**Date:** 2026-07-18
**Replaces:** Star rating system (0–3 `rating` field on records)

## Problem

The current star system (0–3) is too coarse to express meaningful relative importance across a growing collection. Three tiers can't distinguish between, say, a foundational text and a merely good one — both end up at ⭐⭐⭐. The result is that "top tier" becomes a dumping ground and the rating loses signal over time.

## Proposal

Replace star ratings with an **ELO-based ranking system**, scoped per record type (`entity`, `concept`, `artifact`). Records earn their rank through head-to-head comparisons rather than absolute labels.

## Core Concepts

### ELO Scores

- Each record has an `eloScore` (integer, default 1200).
- Scores are scoped by record type — an artifact's ELO is only meaningful relative to other artifacts.
- **Adaptive K-factor:** Each record uses its own K based on its own matchup count (asymmetric updates, standard ELO practice). K=32 for records with <10 matchups, K=24 for 10–30, K=16 for 30+. New records move fast through the ranks; established records stabilize.
- **Matchup counts are derived**, not stored: a record's count is a `COUNT` over `elo_matchups` rows referencing it. At personal-KB scale this is trivially cheap, and it can never drift from the history that defines it.
- Scores are truly unbounded — no floor or ceiling. They naturally cluster around 800–1600 in practice.
- Draws are valid outcomes and split points per standard ELO calculation. Skips leave no trace.

### Matchups

A **matchup** is a head-to-head comparison: the user sees two records of the same type and picks the more important/valuable one, declares a draw, or skips.

**Outcomes:**

- **Win/Loss:** Winner gains points, loser loses points (asymmetric K per record).
- **Draw:** Points split per standard ELO formula.
- **Skip:** No ELO change, no matchup recorded. The opponent is replaced with a new one.

**Storage:** Each matchup (except skips) is persisted to `elo_matchups`. Matchup history is not surfaced in the UI — it's fire-and-forget from the user's perspective; only the resulting score matters.

**Pool:** Matchups draw exclusively from **curated records** (`isCurated`). Uncurated auto-imports are not rankable — curation is the gateway into the arena. Artifacts must additionally be **root-level**: an artifact contained by a parent record (an outgoing `contained_by` link — citation links like `quotes` don't count) is ranked through its parent, not on its own. Concepts and entities always stand alone.

**Deletion behavior:** When a record is deleted, its matchup rows cascade-delete. The opponent's ELO is **not** retroactively recalculated — ELO is a running tally; history is not rewritten.

**Merge behavior:** The surviving record takes the **max** of the two records' scores (mirroring the old max-rating convention). The absorbed record's matchup rows are **repointed** to the survivor (`record_a_id`, `record_b_id`, and `winner_id` references), so its history — and therefore its derived matchup count — carries over. Any matchup rows where the two merged records faced each other are deleted first; repointing them would create self-matchups.

**Consistency:** ELO handles transitive cycles (A > B > C > A) naturally through score adjustments. No cycle detection or prevention logic.

**Cross-type constraint:** Matchups between records of different types are rejected at the server level (tRPC validation). Each type is its own league.

## Ranking Interactions

### Contextual Matchups (Relations Sidebar)

The **primary everyday interaction** with the ELO system. When viewing a record, the relations sidebar includes a collapsible **"Rank"** section showing a few randomly selected opponents. The user can tap one to declare a winner, and both records' scores update immediately with a brief delta animation (e.g., `+18`).

**Why this matters:** Most curation happens while you're already looking at a record — reading its content, editing its metadata, reviewing its links. Embedding matchups in that context means ranking is a natural side-effect of curation rather than a separate chore.

**Behavior:**

- Show 2–3 opponent cards in the sidebar, using the established sidebar record card pattern.
- Each opponent card has two buttons: **thumbs up** (current record wins) and **thumbs down** (opponent wins). Explicit, no ambiguity about which direction the comparison goes.
- After a matchup, the resolved opponent is replaced with a new one, so the user can keep going or stop at any time.
- A **refresh/shuffle button** fetches new opponents without completing a matchup.
- Score delta is shown briefly after each matchup (e.g., `1200 → 1218`) then settles to the new score.
- The section is **collapsible**, with collapsed state persisted in localStorage.
- Below the existing relations/similar-records sections in the sidebar.

**Opponent selection:**

- Default: curated records with similar ELO (±200), same type. If fewer than 2–3 candidates exist in that window, widen until enough opponents are found.
- If the current record has <10 matchups, bias selection toward well-established records (high matchup count) to anchor the new record faster.

### Focused Burst ("Rank This")

A focused matchup mode for quickly triangulating a record's position. Accessible from:

- **Record detail sidebar** — "Rank this" button.
- **Arena page** — search for a record to focus on.

**How it differs from normal matchups:** Opponents are deliberately picked across the full ELO spectrum (not just ±200) to triangulate the record's position quickly. One side of the comparison is always locked to the focused record.

This is **not** a convergence algorithm that "stops" — ranking is perpetual, just as chess players can always play new opponents. The focused burst is simply a convenient way to run a series of informative matchups for one record.

### Arena Page

A dedicated page at `/arena`, linked as **"Arena"** in the main nav, where the user is shown two records of the same type and picks a winner.

**Pair selection heuristic:**

- Prefer records with similar ELO scores (within ±200) — these are the most informative comparisons.
- Prefer records with fewer total matchups (under-ranked records surface first).
- Occasionally surface a wild-card pair (large ELO gap) to catch misranked outliers.

**Arena features:**

- Record type selector (entity / concept / artifact).
- ELO scores are **hidden** before the user picks to avoid anchoring bias, revealed with the delta after.
- Draw and skip available on every matchup.
- Search to focus on a specific record (enters focused burst mode, locking one side).
- **Keyboard shortcuts:** ← / → pick a side, D declares a draw, S skips. Rapid ranking is the point of the page.
- No filters, no session stats — the arena is deliberately serendipitous chrome-free ranking.

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

## Schema

### `records`

```
elo_score  integer  NOT NULL  DEFAULT 1200     -- with index on (type, elo_score)
```

No matchup counter column — counts derive from `elo_matchups`.

### `elo_matchups`

```
id           serial   PRIMARY KEY
record_a_id  integer  NOT NULL  REFERENCES records(id) ON DELETE CASCADE
record_b_id  integer  NOT NULL  REFERENCES records(id) ON DELETE CASCADE
winner_id    integer            REFERENCES records(id) ON DELETE SET NULL   -- null = draw
record_type  record_type NOT NULL   -- denormalized for query performance and historical correctness
created_at   timestamp NOT NULL DEFAULT now()
```

### Removal of `rating`

Clean break: the `rating` column is dropped and all star-related filters, CLI flags, and integration mappings are removed or converted to their ELO equivalents.

## API Surface

### `elo` tRPC router

- `elo.submitMatchup` — Record a win/loss (`{ winnerId, loserId }`) or draw (`{ drawIds: [id, id] }`) in a transaction: validate both records are the same type (reject cross-type), compute asymmetric ELO updates from derived matchup counts, insert the matchup row, update both scores, return the new scores and deltas.
- `elo.getMatchup({ recordType, focusRecordId?, excludeIds? })` — Returns a pair of curated records. Without `focusRecordId`: pair per the arena heuristic. With `focusRecordId`: that record plus an opponent from across the full ELO spectrum (focused burst). `excludeIds` lets skip replace opponents without repeats.
- `elo.getOpponents({ recordId, count })` — Sidebar opponent selection (±200 window with widening, establishment bias for new records).

### Existing API changes

- `records.list`: `eloScore` joins the `orderBy` fields; `minElo` / `maxElo` filters replace `minRating` / `maxRating`. A leaderboard is just `records.list` ordered by `eloScore` — no dedicated endpoint.
- Record detail: exposes `eloScore` and derived matchup count.
- CLI `rcr records list`: `--elo-min` / `--elo-max` replace `--rating-min` / `--rating-max`; `elo` joins the `--order` fields.
- Matchup mutations follow the existing tRPC optimistic-mutation and invalidation patterns.

## UI

- **Record grid:** ELO column shows the score (sortable once `eloScore` is an `orderBy` field).
- **Record detail sidebar:** current ELO score and matchup count, collapsible "Rank" section with opponent cards, "Rank this" button launching focused burst.
- **Arena page:** as described above.
- Raw numbers everywhere — no tier abstraction.

## Integration Mapping

Integrations write mapped record values at creation only (re-sync conflict handlers touch nothing but `recordUpdatedAt`), so ELO seeding from external signals is naturally creation-scoped:

- External importance signals (Readwise star tags, Raindrop `important`, Airtable michelin stars, Adobe ratings) map to creation-time seeds: **no signal → 1200** (the default — absence of signal is not a negative signal), **1–3 stars → 1300 / 1400 / 1500**.
- **ELO is user-sovereign.** Once created, a record's score is controlled exclusively through matchups. Re-syncs never overwrite it; `records.bulkUpdate` excludes it.

## Bootstrap

Initial scores were seeded from a richness heuristic over existing metadata (`(rating + curation boosts) × sqrt(weighted signal sum)`, mapped through per-type percentile → inverse normal CDF centered on 1200, sd 150). The seed has been applied to production; the one-shot seed script is deleted along with the `rating` column it reads. Seeded records carry no matchup history, so K=32 lets real comparisons quickly overturn a bad seed.

## Implementation Plan

### Phase 1: Schema _(done)_

- [x] `eloScore` column + `(type, eloScore)` index
- [x] `elo_matchups` table
- [x] Seed production scores

### Phase 2: ELO engine + tRPC endpoints

- [x] ELO math (expected score, asymmetric adaptive K from derived counts, draw handling)
- [x] `elo.submitMatchup` transaction with cross-type validation
- [x] `elo.getMatchup` (arena heuristic + focused burst) and `elo.getOpponents` (sidebar), curated pool
- [x] `eloScore` in `records.list` orderBy; matchup count on record detail

### Phase 3: Arena page

- [x] `/arena` route + "Arena" nav entry
- [x] Type selector, hidden-score matchup cards, pick/draw/skip, delta reveal
- [x] Keyboard shortcuts (← → D S)
- [x] Search-to-focus (focused burst)

### Phase 4: Sidebar matchups

- [x] Collapsible "Rank" section (localStorage-persisted) below similar records
- [x] Opponent cards with thumbs up/down, skip, refresh
- [x] Score delta animation
- [x] "Rank this" button → focused burst

### Phase 5: Drop `rating`

- [x] Integrations: map star signals to creation-time `eloScore` seeds (1200/1300/1400/1500)
- [x] Merge: survivor takes max `eloScore`; repoint absorbed record's matchups (deleting direct pair matchups first)
- [x] `minElo`/`maxElo` filters + CLI flag swap
- [x] Drop `rating` column (schema + migration), remove remaining references
- [x] Delete `seed-elo.ts`

## Decisions

- **Engine:** Plain ELO with adaptive K — not Glicko or Bradley-Terry. For a single user with no rating periods, rating deviation reduces to a matchup-count proxy, which adaptive K already uses; ELO keeps instant deltas and legible scores. The matchup log is engine-agnostic, so a future migration stays open.
- **K-factor:** Adaptive, per-record (asymmetric). K=32 (<10 matchups), K=24 (10–30), K=16 (30+).
- **Matchup counts:** Derived from `elo_matchups`, never stored. No counter column.
- **Score bounds:** Unbounded. No floor or ceiling.
- **Draws:** Supported. Split points per standard ELO.
- **Skips:** Supported. No ELO change, no row, opponent replaced.
- **Pool:** Curated records only, all interactions. No toggle. Artifacts with a structural parent (`contained_by`) are excluded — only root-level records compete.
- **Score display:** Raw numbers everywhere. No tier abstraction. Brief delta animation after matchups.
- **Arena:** Dedicated `/arena` page, main-nav entry. Scores hidden pre-pick. No filters, no session stats. Keyboard-first.
- **Focused burst:** Opponents across the full ELO spectrum. No convergence endpoint — ranking is perpetual.
- **Sidebar:** "Rank" heading (consistent with "Rank this"). Thumbs up/down per opponent card, refresh, collapsible with persisted state.
- **Cross-type comparison:** Rejected server-side. Each type is its own league.
- **Deletion:** Cascade-delete matchup rows. No retroactive recalculation.
- **Merge:** Survivor takes max score; absorbed record's matchup history repoints to it (direct pair matchups deleted first).
- **Cycles:** No detection or prevention. ELO handles them naturally.
- **Decay:** No score decay. Matchup selection biases toward records that haven't been compared recently.
- **Integration sovereignty:** Creation-time seeds only (no signal → 1200; stars → 1300/1400/1500). Re-syncs and bulk updates never touch ELO.
- **Leaderboard:** `records.list` ordered by `eloScore` — no dedicated endpoint or page.
- **Matchup history:** Not surfaced in UI. Fire-and-forget; only scores matter.
- **Opponent window fallback:** If too few candidates within ±200 ELO, widen the window until enough are found.
