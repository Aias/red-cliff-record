import { defineTokens } from '@pandacss/dev';

const semanticBorders = ['divider', 'border', 'edge', 'focus'] as const;

export const borders = defineTokens.borders({
  none: { value: 'none' },
  ...Object.fromEntries(
    semanticBorders.map((name) => [
      name,
      {
        DEFAULT: { value: `1px solid {colors.${name}}` },
        thin: { value: `0.5px solid {colors.${name}}` },
      },
    ])
  ),
});

// Border tokens wrap semantic colors, and custom properties bake their var()
// substitutions at the declaring element — so theme boundaries must re-declare
// them alongside the color formulas to re-resolve against the new context.
export const borderDeclarations: Record<`--${string}`, string> = Object.fromEntries(
  semanticBorders.flatMap((name) => [
    [`--borders-${name}`, `1px solid var(--colors-${name})`],
    [`--borders-${name}-thin`, `0.5px solid var(--colors-${name})`],
  ])
);
