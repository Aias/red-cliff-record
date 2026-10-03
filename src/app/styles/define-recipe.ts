import type { RecipeConfig, SlotRecipeConfig } from '@pandacss/types';
import type {
  RecipeDefinition,
  RecipeVariantRecord,
  SlotRecipeDefinition,
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

type RecipeMeta = Pick<RecipeConfig, 'className' | 'description' | 'jsx' | 'staticCss'>;

export function defineRecipe<T extends RecipeVariantRecord>(
  config: RecipeDefinition<T> & RecipeMeta
): RecipeConfig {
  return config as RecipeConfig;
}

export function defineSlotRecipe<
  S extends string = string,
  T extends SlotRecipeVariantRecord<S> = SlotRecipeVariantRecord<S>,
>(config: SlotRecipeDefinition<S, T> & RecipeMeta): SlotRecipeConfig {
  return config as SlotRecipeConfig;
}
