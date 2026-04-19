import { defineTokens, defineTextStyles } from '@pandacss/dev';

export const fontFamilies = defineTokens.fonts({
  sans: {
    value: 'IBM Plex Sans, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  serif: {
    value: 'ui-serif, "Georgia", Cambria, "Times New Roman", Times, serif',
  },
  mono: {
    value:
      'Berkeley Mono Variable, Berkeley Mono, ui-monospace, SFMono-Regular, Menlo, monospace, "Apple Color Emoji", "Segoe UI Emoji"',
  },
});

export const fontWeights = defineTokens.fontWeights({
  thin: { value: '100' },
  extralight: { value: '200' },
  light: { value: '300' },
  normal: { value: '400' },
  medium: { value: '500' },
  semibold: { value: '600' },
  bold: { value: '700' },
});

/** Matches Tailwind v4 default font-size scale. */
export const fontSizes = defineTokens.fontSizes({
  xs: { value: '0.75rem' },
  sm: { value: '0.875rem' },
  base: { value: '1rem' },
  lg: { value: '1.125rem' },
  xl: { value: '1.25rem' },
  '2xl': { value: '1.5rem' },
  '3xl': { value: '1.875rem' },
  '4xl': { value: '2.25rem' },
  '5xl': { value: '3rem' },
  '6xl': { value: '3.75rem' },
  '7xl': { value: '4.5rem' },
  '8xl': { value: '6rem' },
  '9xl': { value: '8rem' },
});

/** Matches Tailwind v4 named leading-* values. */
export const lineHeights = defineTokens.lineHeights({
  none: { value: '1' },
  tight: { value: '1.25' },
  snug: { value: '1.375' },
  normal: { value: '1.5' },
  relaxed: { value: '1.625' },
  loose: { value: '2' },
});

/**
 * Matches Tailwind v4 `text-*` utility pairings (font-size + line-height).
 * Line heights use unitless ratios so they scale if font-size is overridden.
 */
export const textStyles = defineTextStyles({
  xs: { value: { fontSize: '0.75rem', lineHeight: 'calc(1 / 0.75)' } },
  sm: { value: { fontSize: '0.875rem', lineHeight: 'calc(1.25 / 0.875)' } },
  base: { value: { fontSize: '1rem', lineHeight: '1.5' } },
  lg: { value: { fontSize: '1.125rem', lineHeight: 'calc(1.75 / 1.125)' } },
  xl: { value: { fontSize: '1.25rem', lineHeight: 'calc(1.75 / 1.25)' } },
  '2xl': { value: { fontSize: '1.5rem', lineHeight: 'calc(2 / 1.5)' } },
  '3xl': { value: { fontSize: '1.875rem', lineHeight: 'calc(2.25 / 1.875)' } },
  '4xl': { value: { fontSize: '2.25rem', lineHeight: 'calc(2.5 / 2.25)' } },
  '5xl': { value: { fontSize: '3rem', lineHeight: '1' } },
  '6xl': { value: { fontSize: '3.75rem', lineHeight: '1' } },
  '7xl': { value: { fontSize: '4.5rem', lineHeight: '1' } },
  '8xl': { value: { fontSize: '6rem', lineHeight: '1' } },
  '9xl': { value: { fontSize: '8rem', lineHeight: '1' } },
});
