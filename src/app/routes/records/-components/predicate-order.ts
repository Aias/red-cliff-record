import type { PredicateType } from '@hozo';
import { exhaustive } from '@/shared/lib/type-utils';

/** Predicate types in display priority order (first = highest priority) */
export const PREDICATE_TYPE_ORDER = exhaustive<PredicateType>()([
  'identity',
  'containment',
  'creation',
  'reference',
  'association',
  'form',
  'description',
]);
