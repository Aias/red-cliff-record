import type { PredicateType } from './records.shared';

/**
 * Predicate definition for relationship types between records.
 *
 * Predicates define the semantic meaning of links (edges) in the knowledge graph.
 * Each predicate has a canonical form and an inverse for traversing the edge
 * in the opposite direction.
 */
export interface Predicate {
  /** Unique identifier slug (e.g., 'created_by', 'contained_by') */
  slug: string;
  /** Human-readable name (e.g., 'created by', 'contained by') */
  name: string;
  /** Category of relationship */
  type: PredicateType;
  /** Optional role (e.g., 'creator', 'editor') for creation predicates */
  role?: string;
  /** Slug of the inverse predicate */
  inverseSlug: string;
  /**
   * Whether this is the canonical direction for storage.
   * Only canonical predicates are stored in the `links` table.
   * Non-canonical predicates are flipped to their canonical inverse.
   */
  canonical: boolean;
}

/**
 * Canonical predicate vocabulary
 *
 * - Only rows with `canonical: true` are stored in `links`.
 * - `inverseSlug` supplies a readable label when traversing the edge
 *   in the opposite direction.
 * - Active-present verb style: created_by, contained_by, format_of...
 */
export const PREDICATES = {
  /* ────────────  Creation  ──────────── */
  created_by: {
    slug: 'created_by',
    name: 'created by',
    type: 'creation',
    role: 'creator',
    inverseSlug: 'creator_of',
    canonical: true,
  },
  creator_of: {
    slug: 'creator_of',
    name: 'creator of',
    type: 'creation',
    role: 'creator',
    inverseSlug: 'created_by',
    canonical: false,
  },
  via: {
    slug: 'via',
    name: 'via',
    type: 'creation',
    role: 'referrer',
    inverseSlug: 'source_for',
    canonical: true,
  },
  source_for: {
    slug: 'source_for',
    name: 'source for',
    type: 'creation',
    role: 'referrer',
    inverseSlug: 'via',
    canonical: false,
  },
  edited_by: {
    slug: 'edited_by',
    name: 'edited by',
    type: 'creation',
    role: 'editor',
    inverseSlug: 'editor_of',
    canonical: true,
  },
  editor_of: {
    slug: 'editor_of',
    name: 'editor of',
    type: 'creation',
    role: 'editor',
    inverseSlug: 'edited_by',
    canonical: false,
  },
  translated_by: {
    slug: 'translated_by',
    name: 'translated by',
    type: 'creation',
    role: 'translator',
    inverseSlug: 'translator_of',
    canonical: true,
  },
  translator_of: {
    slug: 'translator_of',
    name: 'translator of',
    type: 'creation',
    role: 'translator',
    inverseSlug: 'translated_by',
    canonical: false,
  },

  /* ─────── Containment (child → parent) ─────── */
  contained_by: {
    slug: 'contained_by',
    name: 'contained by',
    type: 'containment',
    inverseSlug: 'contains',
    canonical: true,
  },
  contains: {
    slug: 'contains',
    name: 'contains',
    type: 'containment',
    inverseSlug: 'contained_by',
    canonical: false,
  },
  quotes: {
    slug: 'quotes',
    name: 'quotes',
    type: 'containment',
    inverseSlug: 'quoted_in',
    canonical: true,
  },
  quoted_in: {
    slug: 'quoted_in',
    name: 'quoted in',
    type: 'containment',
    inverseSlug: 'quotes',
    canonical: false,
  },

  /* ───────────  Form  ─────────── */
  has_format: {
    slug: 'has_format',
    name: 'has format',
    type: 'form',
    inverseSlug: 'format_of',
    canonical: true,
  },
  format_of: {
    slug: 'format_of',
    name: 'format of',
    type: 'form',
    inverseSlug: 'has_format',
    canonical: false,
  },

  /* ───────────  Description  ─────────── */
  tagged_with: {
    slug: 'tagged_with',
    name: 'tagged with',
    type: 'description',
    inverseSlug: 'tag_of',
    canonical: true,
  },
  tag_of: {
    slug: 'tag_of',
    name: 'tag of',
    type: 'description',
    inverseSlug: 'tagged_with',
    canonical: false,
  },

  /* ───────────  Reference  ─────────── */
  references: {
    slug: 'references',
    name: 'references',
    type: 'reference',
    inverseSlug: 'referenced_by',
    canonical: true,
  },
  referenced_by: {
    slug: 'referenced_by',
    name: 'referenced by',
    type: 'reference',
    inverseSlug: 'references',
    canonical: false,
  },
  about: {
    slug: 'about',
    name: 'about',
    type: 'reference',
    inverseSlug: 'subject_of',
    canonical: true,
  },
  subject_of: {
    slug: 'subject_of',
    name: 'subject of',
    type: 'reference',
    inverseSlug: 'about',
    canonical: false,
  },
  responds_to: {
    slug: 'responds_to',
    name: 'responds to',
    type: 'reference',
    inverseSlug: 'responded_by',
    canonical: true,
  },
  responded_by: {
    slug: 'responded_by',
    name: 'responded by',
    type: 'reference',
    inverseSlug: 'responds_to',
    canonical: false,
  },

  /* ───────────  Association  ─────────── */
  related_to: {
    slug: 'related_to',
    name: 'related to',
    type: 'association',
    inverseSlug: 'related_to', // self-inverse
    canonical: true,
  },
  counters: {
    slug: 'counters',
    name: 'counters',
    type: 'association',
    inverseSlug: 'countered_by',
    canonical: true,
  },
  countered_by: {
    slug: 'countered_by',
    name: 'countered by',
    type: 'association',
    inverseSlug: 'counters',
    canonical: false,
  },

  /* ───────────  Identity  ─────────── */
  same_as: {
    slug: 'same_as',
    name: 'same as',
    type: 'identity',
    inverseSlug: 'same_as', // self-inverse
    canonical: true,
  },
} as const satisfies Record<string, Predicate>;

/** Union type of all valid predicate slugs */
export type PredicateSlug = keyof typeof PREDICATES;

/** Array of all predicate slugs for validation */
export const predicateSlugs = Object.keys(PREDICATES);

/** Array of canonical predicates (those that get stored in links table) */
export const canonicalPredicates = Object.values(PREDICATES).filter((p) => p.canonical);

/** Array of canonical predicate slugs */
export const canonicalPredicateSlugs = canonicalPredicates.map((p) => p.slug);

/**
 * Get the inverse predicate for a given slug.
 * For self-inverse predicates (related_to, same_as), returns the same predicate.
 */
export function getInverse(slug: PredicateSlug): Predicate {
  const predicate = PREDICATES[slug];
  return PREDICATES[predicate.inverseSlug];
}

/**
 * Get a predicate by its slug.
 * Type-safe accessor for predicate definitions.
 */
export function getPredicate(slug: PredicateSlug): Predicate {
  return PREDICATES[slug];
}

/**
 * Check if a string is a valid predicate slug.
 */
export function isPredicateSlug(value: string): value is PredicateSlug {
  return value in PREDICATES;
}

/** Predicate slugs for all containment relationships (structural and citation) */
export const containmentPredicateSlugs = Object.values(PREDICATES)
  .filter((p) => p.type === 'containment')
  .map((p) => p.slug);

/** Predicate slugs for structural parent-child hierarchies only (excludes citation) */
export const structuralContainmentSlugs: PredicateSlug[] = ['contained_by', 'contains'];

/** Check if a predicate is structural containment (vs citation like quotes) */
export function isStructuralContainment(slug: PredicateSlug): boolean {
  return structuralContainmentSlugs.includes(slug);
}
