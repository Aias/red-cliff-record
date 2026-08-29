import { defineTokens } from '@pandacss/dev';
import {
  bronze,
  bronzeDark,
  brown,
  brownDark,
  gold,
  goldDark,
  grass,
  grassDark,
  iris,
  irisDark,
  mauve,
  mauveDark,
  olive,
  oliveDark,
  sand,
  sandDark,
  slate,
  slateDark,
  tomato,
  tomatoDark,
} from '@radix-ui/colors';

// ---------------------------------------------------------------------------
// Color engine
//
// Three inherited axes, each settable anywhere in the tree:
//   palette — `palette: 'artifact'` aliases a chromatic hue ramp to --clr-* and
//             its associated neutral ramp to --neu-*
//   chroma  — `chromatic: true | false` sets --chroma to 100% | 0%
//   mode    — `mode: 'dark' | ...` sets color-scheme; light-dark() resolves at
//             the consuming element, so mode needs no variable machinery
//
// Every semantic color token is a single formula over --clr-*, --neu-*, and
// --chroma: color-mix(in oklch, <neutral variant>, <chromatic variant> var(--chroma)).
// The --chroma dial (rather than baked-in variants) is what lets a palette
// boundary stay chroma-agnostic and compose with chromaticity in any nesting
// order.
//
// Custom properties substitute their var() references at the element where
// they are declared, and descendants inherit the resolved stream. The palette
// and chromatic utilities (plugins.ts) therefore re-declare every formula at
// each boundary element so the subtree re-resolves against its new context.
// ---------------------------------------------------------------------------

const WHITE = 'oklch(1 0 0)';
const BLACK = 'oklch(0 0 0)';

const lightDark = (light: string, dark: string) => `light-dark(${light}, ${dark})`;

const scaleSteps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
type ScaleStep = (typeof scaleSteps)[number];
type RadixScale = Record<string, string>;

const getRadixScaleStep = (scale: RadixScale, step: ScaleStep): string => {
  const match = Object.entries(scale).find(([key]) => key.match(/\d+$/)?.[0] === `${step}`);

  if (!match) {
    throw new Error(`Missing Radix color step ${step}`);
  }

  return match[1];
};

const zipRadixScale = (
  lightScale: RadixScale,
  darkScale: RadixScale,
  foregroundColor: 'white' | 'black' = 'white' // Only Sky, Mint, Lime, Yellow, and Amber are designed for dark foreground text.
) => ({
  ...Object.fromEntries(
    scaleSteps.map((step) => [
      step,
      { value: lightDark(getRadixScaleStep(lightScale, step), getRadixScaleStep(darkScale, step)) },
    ])
  ),
  contrast: { value: foregroundColor === 'black' ? BLACK : WHITE },
});

const hues = {
  bronze: zipRadixScale(bronze, bronzeDark),
  brown: zipRadixScale(brown, brownDark),
  gold: zipRadixScale(gold, goldDark),
  grass: zipRadixScale(grass, grassDark),
  iris: zipRadixScale(iris, irisDark),
  mauve: zipRadixScale(mauve, mauveDark),
  olive: zipRadixScale(olive, oliveDark),
  sand: zipRadixScale(sand, sandDark),
  slate: zipRadixScale(slate, slateDark),
  tomato: zipRadixScale(tomato, tomatoDark),
};
type HueName = keyof typeof hues;

export const palettes = {
  artifact: { chromatic: 'gold', neutral: 'sand' },
  concept: { chromatic: 'brown', neutral: 'sand' },
  entity: { chromatic: 'bronze', neutral: 'sand' },
  error: { chromatic: 'tomato', neutral: 'mauve' },
  info: { chromatic: 'iris', neutral: 'slate' },
  success: { chromatic: 'grass', neutral: 'olive' },
} as const satisfies Record<string, { chromatic: HueName; neutral: HueName }>;
export type PaletteName = keyof typeof palettes;

type SemanticVariants = { neutral: string; chromatic: string };

const semanticColors = {
  display: {
    neutral: 'color-mix(in oklch, var(--neu-12), var(--colors-mode-contrast))',
    chromatic:
      'light-dark(var(--clr-12), color-mix(in oklch, var(--clr-12), var(--colors-mode-contrast)))',
  },
  primary: {
    neutral: 'var(--neu-12)',
    chromatic: 'light-dark(color-mix(in oklch, var(--clr-11), var(--neu-12)), var(--clr-12))',
  },
  secondary: {
    neutral: 'var(--neu-11)',
    chromatic:
      'light-dark(color-mix(in oklch, var(--clr-9), var(--neu-12)), color-mix(in oklch, var(--clr-12), var(--neu-9)))',
  },
  muted: {
    neutral: 'color-mix(in oklch, var(--neu-9), var(--neu-10))',
    chromatic: 'color-mix(in oklch, var(--clr-9) 75%, var(--neu-9))',
  },
  symbol: {
    neutral: 'color-mix(in oklch, var(--neu-11) 75%, var(--clr-10))',
    chromatic: 'color-mix(in oklch, var(--clr-11) 75%, var(--neu-10))',
  },
  accent: {
    neutral: 'color-mix(in oklch, var(--neu-11), var(--clr-11))',
    chromatic: 'var(--clr-11)',
  },
  accentActive: {
    neutral: 'color-mix(in oklch, var(--neu-12), var(--clr-11))',
    chromatic: 'color-mix(in oklch, var(--clr-12), var(--clr-11))',
  },
  background: {
    neutral: 'light-dark(var(--neu-2), var(--neu-1))',
    chromatic: 'light-dark(color-mix(in oklch, var(--clr-1), var(--clr-2)), var(--clr-1))',
  },
  surface: {
    neutral: 'light-dark(var(--neu-1), var(--neu-2))',
    chromatic: 'light-dark(color-mix(in oklch, var(--clr-2), var(--clr-3)), var(--clr-2))',
  },
  container: {
    neutral: 'color-mix(in oklch, var(--neu-2), var(--neu-3))',
    chromatic: 'light-dark(color-mix(in oklch, var(--clr-3), var(--clr-4)), var(--clr-3))',
  },
  float: {
    neutral: `light-dark(${WHITE}, var(--neu-3))`,
    chromatic: 'light-dark(color-mix(in oklch, var(--clr-3), var(--clr-4)), var(--clr-3))',
  },
  divider: {
    neutral: 'light-dark(var(--neu-6), var(--neu-5))',
    chromatic: 'light-dark(var(--clr-6), var(--clr-4))',
  },
  border: {
    neutral: 'light-dark(var(--neu-7), var(--neu-6))',
    chromatic: 'light-dark(var(--clr-7), var(--clr-5))',
  },
  edge: {
    neutral: 'light-dark(var(--neu-8), var(--neu-7))',
    chromatic: 'light-dark(var(--clr-8), var(--clr-6))',
  },
  focus: {
    neutral: 'color-mix(in oklch, var(--neu-9) 75%, var(--clr-9))',
    chromatic: 'light-dark(var(--clr-9), var(--clr-8))',
  },
  mist: {
    neutral: 'color-mix(in oklch, var(--neu-9) 3%, transparent)',
    chromatic: 'color-mix(in oklch, var(--clr-9) 3%, transparent)',
  },
  splash: {
    neutral: 'color-mix(in oklch, var(--neu-9) 6%, transparent)',
    chromatic: 'color-mix(in oklch, var(--clr-9) 6%, transparent)',
  },
  flood: {
    neutral: 'color-mix(in oklch, var(--neu-9) 9%, transparent)',
    chromatic: 'color-mix(in oklch, var(--clr-9) 9%, transparent)',
  },
  main: {
    neutral: 'var(--neu-9)',
    chromatic: 'var(--clr-9)',
  },
  mainActive: {
    neutral: 'var(--neu-10)',
    chromatic: 'var(--clr-10)',
  },
  mainContrast: {
    neutral: 'var(--neu-contrast)',
    chromatic: 'var(--clr-contrast)',
  },
} as const satisfies Record<string, SemanticVariants>;

const blend = ({ neutral, chromatic }: SemanticVariants) =>
  `color-mix(in oklch, ${neutral}, ${chromatic} var(--chroma, 0%))`;

export type CssVarDeclarations = Record<`--${string}`, string>;

const toCssVarName = (value: string) =>
  value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const semanticColorDeclarations = Object.fromEntries(
  Object.entries(semanticColors).map(([name, variants]) => [
    `--colors-${toCssVarName(name)}`,
    blend(variants),
  ])
);

const rampDeclarations = (prefix: 'clr' | 'neu', hue: HueName) => ({
  ...Object.fromEntries(
    scaleSteps.map((step) => [`--${prefix}-${step}`, `var(--colors-${hue}-${step})`])
  ),
  [`--${prefix}-contrast`]: `var(--colors-${hue}-contrast)`,
});

export const paletteDeclarations = (palette: PaletteName): CssVarDeclarations => ({
  ...rampDeclarations('clr', palettes[palette].chromatic),
  ...rampDeclarations('neu', palettes[palette].neutral),
  ...semanticColorDeclarations,
});

export const chromaticDeclarations = (chromatic: boolean): CssVarDeclarations => ({
  '--chroma': chromatic ? '100%' : '0%',
  ...semanticColorDeclarations,
});

export const colors = defineTokens.colors({
  transparent: { value: 'transparent' },
  currentColor: { value: 'currentColor' },
  white: { value: WHITE },
  black: { value: BLACK },
  modeContrast: { value: lightDark(BLACK, WHITE) },
  ...hues,
  ...Object.fromEntries(
    Object.entries(semanticColors).map(([name, variants]) => [name, { value: blend(variants) }])
  ),
});
