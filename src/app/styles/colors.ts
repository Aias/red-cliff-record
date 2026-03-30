import { defineSemanticTokens, defineTokens } from '@pandacss/dev';
import { sand, sandDark, sage, sageDark, mauve, mauveDark } from '@radix-ui/colors';

type LightDarkColorString = `light-dark(${string}, ${string})`;
type ScaleStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type RadixScale = Record<string, string>;
type ColorToken = { value: LightDarkColorString };

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

export const zipRadixScale = (lightScale: RadixScale, darkScale: RadixScale): PaletteScale => ({
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
});

const toColorTokens = (scale: PaletteScale): Record<ScaleStep, ColorToken> => ({
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
});

export const colors = defineTokens.colors({
  transparent: { value: 'transparent' },
  currentColor: { value: 'currentColor' },
  white: { value: 'white' },
  black: { value: 'black' },
  sand: toColorTokens(zipRadixScale(sand, sandDark)),
  sage: toColorTokens(zipRadixScale(sage, sageDark)),
  mauve: toColorTokens(zipRadixScale(mauve, mauveDark)),
});

export const semanticColors = defineSemanticTokens.colors({
  modeContrast: { value: 'light-dark({colors.black}, {colors.white})' },
});
