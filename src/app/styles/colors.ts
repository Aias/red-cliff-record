import { defineSemanticTokens, defineTokens } from '@pandacss/dev';
import {
  sand,
  sandDark,
  sage,
  sageDark,
  mauve,
  mauveDark,
  amber,
  amberDark,
  grass,
  grassDark,
  olive,
  oliveDark,
  teal,
  tealDark,
  iris,
  irisDark,
  tomato,
  tomatoDark,
  gold,
  goldDark,
  bronze,
  bronzeDark,
  gray,
  grayDark,
  brown,
  brownDark,
  slate,
  slateDark,
  // blackA,
  // whiteA,
} from '@radix-ui/colors';
import { PREFIX } from './constants';

const WHITE = 'oklch(1 0 0)';
const BLACK = 'oklch(0 0 0)';

type NeutralPaletteName = 'mauve' | 'slate' | 'sage' | 'olive' | 'sand' | 'gray';
type ChromaticPaletteName =
  | 'tomato'
  | 'red'
  | 'ruby'
  | 'crimson'
  | 'pink'
  | 'plum'
  | 'purple'
  | 'violet'
  | 'iris'
  | 'indigo'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'mint'
  | 'teal'
  | 'jade'
  | 'green'
  | 'grass'
  | 'lime'
  | 'yellow'
  | 'amber'
  | 'orange'
  | 'brown'
  | 'gold'
  | 'bronze';

const neutralAssociations: Record<ChromaticPaletteName, NeutralPaletteName> = {
  tomato: 'mauve',
  red: 'mauve',
  ruby: 'mauve',
  crimson: 'mauve',
  pink: 'mauve',
  plum: 'mauve',
  purple: 'mauve',
  violet: 'mauve',
  iris: 'slate',
  indigo: 'slate',
  blue: 'slate',
  sky: 'slate',
  cyan: 'slate',
  mint: 'sage',
  teal: 'sage',
  jade: 'sage',
  green: 'sage',
  grass: 'olive',
  lime: 'olive',
  yellow: 'sand',
  amber: 'sand',
  orange: 'sand',
  brown: 'sand',
  gold: 'sand',
  bronze: 'sand',
};

// type SemanticPaletteName = 'artifact' | 'entity' | 'concept' | 'error' | 'success' | 'info';

type ForegroundColor = 'white' | 'black';
type LightDarkColorString = `light-dark(${string}, ${string})`;
type ScaleStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type RadixScale = Record<string, string>;
type ColorToken = { value: string };
type ConditionalSemanticColorValue = { base: string; _chromatic: string };

type PaletteScale = {
  1: LightDarkColorString;
  2: LightDarkColorString;
  3: LightDarkColorString;
  4: LightDarkColorString;
  5: LightDarkColorString;
  6: LightDarkColorString;
  7: LightDarkColorString;
  8: LightDarkColorString;
  9: LightDarkColorString;
  10: LightDarkColorString;
  11: LightDarkColorString;
  12: LightDarkColorString;
  contrast: string;
};

type SemanticPaletteScale = {
  display: string;
  primary: string;
  secondary: string;
  muted: string;
  symbol: string;
  accent: string;
  accentActive: string;
  background: string;
  surface: string;
  container: string;
  float: string;
  divider: string;
  border: string;
  edge: string;
  focus: string;
  mist: string;
  splash: string;
  flood: string;
  main: string;
  mainActive: string;
  mainContrast: string;
};

const lightDark = (light: string, dark: string): LightDarkColorString =>
  `light-dark(${light}, ${dark})`;

const getRadixScaleStep = (scale: RadixScale, step: ScaleStep): string => {
  const match = Object.entries(scale).find(([key]) => key.match(/\d+$/)?.[0] === `${step}`);

  if (!match) {
    throw new Error(`Missing Radix color step ${step}`);
  }

  return match[1];
};

export const zipRadixScale = (
  lightScale: RadixScale,
  darkScale: RadixScale,
  foregroundColor?: ForegroundColor
): PaletteScale => ({
  1: lightDark(getRadixScaleStep(lightScale, 1), getRadixScaleStep(darkScale, 1)),
  2: lightDark(getRadixScaleStep(lightScale, 2), getRadixScaleStep(darkScale, 2)),
  3: lightDark(getRadixScaleStep(lightScale, 3), getRadixScaleStep(darkScale, 3)),
  4: lightDark(getRadixScaleStep(lightScale, 4), getRadixScaleStep(darkScale, 4)),
  5: lightDark(getRadixScaleStep(lightScale, 5), getRadixScaleStep(darkScale, 5)),
  6: lightDark(getRadixScaleStep(lightScale, 6), getRadixScaleStep(darkScale, 6)),
  7: lightDark(getRadixScaleStep(lightScale, 7), getRadixScaleStep(darkScale, 7)),
  8: lightDark(getRadixScaleStep(lightScale, 8), getRadixScaleStep(darkScale, 8)),
  9: lightDark(getRadixScaleStep(lightScale, 9), getRadixScaleStep(darkScale, 9)),
  10: lightDark(getRadixScaleStep(lightScale, 10), getRadixScaleStep(darkScale, 10)),
  11: lightDark(getRadixScaleStep(lightScale, 11), getRadixScaleStep(darkScale, 11)),
  12: lightDark(getRadixScaleStep(lightScale, 12), getRadixScaleStep(darkScale, 12)),
  contrast: foregroundColor === 'black' ? BLACK : WHITE, // Default to white contrast text for most palettes. Only Sky, Mint, Lime, Yellow, and Amber are designed for dark foreground text.
});

const toColorTokens = (
  scale: PaletteScale
): Record<ScaleStep, ColorToken> & { contrast: { value: string } } => ({
  1: { value: scale[1] },
  2: { value: scale[2] },
  3: { value: scale[3] },
  4: { value: scale[4] },
  5: { value: scale[5] },
  6: { value: scale[6] },
  7: { value: scale[7] },
  8: { value: scale[8] },
  9: { value: scale[9] },
  10: { value: scale[10] },
  11: { value: scale[11] },
  12: { value: scale[12] },
  contrast: { value: scale.contrast },
});

type SemanticPalettePair = { neutral: SemanticPaletteScale; chromatic: SemanticPaletteScale };
const toSemanticPalettePair = (chromaticScale: ChromaticPaletteName): SemanticPalettePair => {
  const associatedNeutral = neutralAssociations[chromaticScale];
  const neu = associatedNeutral;
  const clr = chromaticScale;
  return {
    neutral: {
      display: `color-mix(in oklch, {colors.${neu}.12}, {colors.modeContrast})`,
      primary: `{colors.${neu}.12}`,
      secondary: `{colors.${neu}.11}`,
      muted: `color-mix(in oklch, {colors.${neu}.9}, {colors.${neu}.10})`,
      symbol: `color-mix(in oklch, {colors.${neu}.11} 75%, {colors.${clr}.10})`,
      accent: `color-mix(in oklch, {colors.${neu}.11}, {colors.${clr}.11})`,
      accentActive: `color-mix(in oklch, {colors.${neu}.12}, {colors.${clr}.11})`,
      background: `light-dark({colors.${neu}.2}, {colors.${neu}.1})`,
      surface: `light-dark({colors.${neu}.1}, {colors.${neu}.2})`,
      container: `color-mix(in oklch, {colors.${neu}.2}, {colors.${neu}.3})`,
      float: `light-dark(${WHITE}, {colors.${neu}.3})`,
      divider: `light-dark({colors.${neu}.6}, {colors.${neu}.5})`,
      border: `light-dark({colors.${neu}.7}, {colors.${neu}.6})`,
      edge: `light-dark({colors.${neu}.8}, {colors.${neu}.7})`,
      focus: `color-mix(in oklch, {colors.${neu}.9} 75%, {colors.${clr}.9})`,
      mist: `color-mix(in oklch, {colors.${neu}.9} 3%, transparent)`,
      splash: `color-mix(in oklch, {colors.${neu}.9} 6%, transparent)`,
      flood: `color-mix(in oklch, {colors.${neu}.9} 9%, transparent)`,
      main: `{colors.${neu}.9}`,
      mainActive: `{colors.${neu}.10}`,
      mainContrast: `{colors.${neu}.contrast}`,
    },
    chromatic: {
      display: `light-dark({colors.${clr}.12}, color-mix(in oklch, {colors.${clr}.12}, {colors.modeContrast}))`,
      primary: `light-dark(color-mix(in oklch, {colors.${clr}.11}, {colors.${neu}.12}), {colors.${clr}.12})`,
      secondary: `light-dark(color-mix(in oklch, {colors.${clr}.9}, {colors.${neu}.12}), color-mix(in oklch, {colors.${clr}.12}, {colors.${neu}.9}))`,
      muted: `color-mix(in oklch, {colors.${clr}.9} 75%, {colors.${neu}.9})`,
      symbol: `color-mix(in oklch, {colors.${clr}.11} 75%, {colors.${neu}.10})`,
      accent: `{colors.${clr}.11}`,
      accentActive: `color-mix(in oklch, {colors.${clr}.12}, {colors.${clr}.11})`,
      background: `light-dark(color-mix(in oklch, {colors.${clr}.1}, {colors.${clr}.2}), {colors.${clr}.1})`,
      surface: `light-dark(color-mix(in oklch, {colors.${clr}.2}, {colors.${clr}.3}), {colors.${clr}.2})`,
      container: `light-dark(color-mix(in oklch, {colors.${clr}.3}, {colors.${clr}.4}), {colors.${clr}.3})`,
      float: `light-dark(color-mix(in oklch, {colors.${clr}.3}, {colors.${clr}.4}), {colors.${clr}.3})`,
      divider: `light-dark({colors.${clr}.6}, {colors.${clr}.4})`,
      border: `light-dark({colors.${clr}.7}, {colors.${clr}.5})`,
      edge: `light-dark({colors.${clr}.8}, {colors.${clr}.6})`,
      focus: `light-dark({colors.${clr}.9}, {colors.${clr}.8})`,
      mist: `color-mix(in oklch, {colors.${clr}.9} 3%, transparent)`,
      splash: `color-mix(in oklch, {colors.${clr}.9} 6%, transparent)`,
      flood: `color-mix(in oklch, {colors.${clr}.9} 9%, transparent)`,
      main: `{colors.${clr}.9}`,
      mainActive: `{colors.${clr}.10}`,
      mainContrast: `{colors.${clr}.contrast}`,
    },
  };
};

const toConditionalSemanticTokens = (
  pair: SemanticPalettePair
): Record<keyof SemanticPaletteScale, { value: ConditionalSemanticColorValue }> => {
  return Object.fromEntries(
    (Object.keys(pair.neutral) as (keyof SemanticPaletteScale)[]).map((key) => [
      key,
      { value: { base: pair.neutral[key], _chromatic: pair.chromatic[key] } },
    ])
  ) as Record<keyof SemanticPaletteScale, { value: ConditionalSemanticColorValue }>;
};

const mauveScale = zipRadixScale(mauve, mauveDark);
const tomatoScale = zipRadixScale(tomato, tomatoDark);
const sandScale = zipRadixScale(sand, sandDark);
const sageScale = zipRadixScale(sage, sageDark);
const slateScale = zipRadixScale(slate, slateDark);
const oliveScale = zipRadixScale(olive, oliveDark);
const tealScale = zipRadixScale(teal, tealDark);
const irisScale = zipRadixScale(iris, irisDark);
const amberScale = zipRadixScale(amber, amberDark, 'black');
const grassScale = zipRadixScale(grass, grassDark);
const goldScale = zipRadixScale(gold, goldDark);
const bronzeScale = zipRadixScale(bronze, bronzeDark);
const brownScale = zipRadixScale(brown, brownDark);
const grayScale = zipRadixScale(gray, grayDark);

export const colors = defineTokens.colors({
  transparent: { value: 'transparent' },
  currentColor: { value: 'currentColor' },
  white: { value: WHITE },
  black: { value: BLACK },
  modeContrast: { value: lightDark(BLACK, WHITE) },
  mauve: toColorTokens(mauveScale),
  tomato: toColorTokens(tomatoScale),
  sand: toColorTokens(sandScale),
  sage: toColorTokens(sageScale),
  slate: toColorTokens(slateScale),
  olive: toColorTokens(oliveScale),
  teal: toColorTokens(tealScale),
  iris: toColorTokens(irisScale),
  amber: toColorTokens(amberScale),
  grass: toColorTokens(grassScale),
  gold: toColorTokens(goldScale),
  bronze: toColorTokens(bronzeScale),
  brown: toColorTokens(brownScale),
  gray: toColorTokens(grayScale),
});

export const semanticColors = defineSemanticTokens.colors({
  artifact: toConditionalSemanticTokens(toSemanticPalettePair('gold')),
  entity: toConditionalSemanticTokens(toSemanticPalettePair('bronze')),
  concept: toConditionalSemanticTokens(toSemanticPalettePair('amber')),
  error: toConditionalSemanticTokens(toSemanticPalettePair('tomato')),
  success: toConditionalSemanticTokens(toSemanticPalettePair('grass')),
  info: toConditionalSemanticTokens(toSemanticPalettePair('iris')),
  display: { value: `var(--${PREFIX}-colors-color-palette-display)` },
  primary: { value: `var(--${PREFIX}-colors-color-palette-primary)` },
  secondary: { value: `var(--${PREFIX}-colors-color-palette-secondary)` },
  muted: { value: `var(--${PREFIX}-colors-color-palette-muted)` },
  symbol: { value: `var(--${PREFIX}-colors-color-palette-symbol)` },
  accent: { value: `var(--${PREFIX}-colors-color-palette-accent)` },
  accentActive: { value: `var(--${PREFIX}-colors-color-palette-accent-active)` },
  background: { value: `var(--${PREFIX}-colors-color-palette-background)` },
  surface: { value: `var(--${PREFIX}-colors-color-palette-surface)` },
  container: { value: `var(--${PREFIX}-colors-color-palette-container)` },
  float: { value: `var(--${PREFIX}-colors-color-palette-float)` },
  divider: { value: `var(--${PREFIX}-colors-color-palette-divider)` },
  border: { value: `var(--${PREFIX}-colors-color-palette-border)` },
  edge: { value: `var(--${PREFIX}-colors-color-palette-edge)` },
  focus: { value: `var(--${PREFIX}-colors-color-palette-focus)` },
  mist: { value: `var(--${PREFIX}-colors-color-palette-mist)` },
  splash: { value: `var(--${PREFIX}-colors-color-palette-splash)` },
  flood: { value: `var(--${PREFIX}-colors-color-palette-flood)` },
  main: { value: `var(--${PREFIX}-colors-color-palette-main)` },
  mainActive: { value: `var(--${PREFIX}-colors-color-palette-main-active)` },
  mainContrast: { value: `var(--${PREFIX}-colors-color-palette-main-contrast)` },
});
