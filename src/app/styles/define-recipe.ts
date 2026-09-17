import type { RecipeConfig, SlotRecipeConfig } from '@pandacss/types';
import type {
  RecipeDefinition as TypeSafeRecipeConfig,
  RecipeVariantRecord,
  SlotRecipeDefinition as TypeSafeSlotRecipeConfig,
  SlotRecipeVariantRecord,
} from '@/styled-system/types';

/**
 * Type-safe versions of `defineRecipe` and `defineSlotRecipe` that respect
 * the strictness and generated types from `styled-system/types`.
 *
 * The standard versions from `@pandacss/dev` use a loose `SystemStyleObject`
 * with a `[key: string]` index signature that silently accepts any property.
 * These wrappers use the generated strict types instead.
 *
 * @see https://github.com/chakra-ui/panda/discussions/1776#discussioncomment-8198659
 */

/** Non-style recipe metadata (`className`, `description`, `jsx`, `staticCss`, …) that the
 * generated `RecipeDefinition` types no longer carry in Panda v2. */
type RecipeMeta = Omit<RecipeConfig, 'base' | 'variants' | 'defaultVariants' | 'compoundVariants'>;
type SlotRecipeMeta = Omit<
  SlotRecipeConfig,
  'slots' | 'base' | 'variants' | 'defaultVariants' | 'compoundVariants'
>;

export function defineRecipe<T extends RecipeVariantRecord>(
  config: TypeSafeRecipeConfig<T> & RecipeMeta
): RecipeConfig {
  return config as RecipeConfig;
}

export function defineSlotRecipe<
  S extends string = string,
  T extends SlotRecipeVariantRecord<S> = SlotRecipeVariantRecord<S>,
>(config: TypeSafeSlotRecipeConfig<S, T> & SlotRecipeMeta): SlotRecipeConfig {
  return config as SlotRecipeConfig;
}
