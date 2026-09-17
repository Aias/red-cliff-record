import type { RecipeConfig, SlotRecipeConfig } from '@pandacss/dev';
import type {
  RecipeConfig as TypeSafeRecipeConfig,
  RecipeVariantRecord,
  SlotRecipeConfig as TypeSafeSlotRecipeConfig,
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

export function defineRecipe<T extends RecipeVariantRecord>(
  config: TypeSafeRecipeConfig<T>
): RecipeConfig {
  return config as RecipeConfig;
}

export function defineSlotRecipe<
  S extends string = string,
  T extends SlotRecipeVariantRecord<S> = SlotRecipeVariantRecord<S>,
>(config: TypeSafeSlotRecipeConfig<S, T>): SlotRecipeConfig {
  return config as SlotRecipeConfig;
}
