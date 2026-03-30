import { defineGlobalStyles } from '@pandacss/dev';

export const globalStyles = defineGlobalStyles({
  html: {
    scrollbarWidth: 'thin',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    fontSmooth: 'antialiased',
    fontVariantLigatures: 'common-ligatures',
    fontVariantNumeric: 'tabular-nums',
  },
  ':root': {
    colorScheme: 'light dark',
    '--chroma': '0%',
    colorPalette: 'artifact',
  },
  '[data-palette="artifact"]': {
    colorPalette: 'artifact',
  },
  '[data-palette="entity"]': {
    colorPalette: 'entity',
  },
  '[data-palette="concept"]': {
    colorPalette: 'concept',
  },
  '[data-palette="error"]': {
    colorPalette: 'error',
  },
  '[data-palette="success"]': {
    colorPalette: 'success',
  },
  '[data-palette="info"]': {
    colorPalette: 'info',
  },
  '[data-chroma="chromatic"]': {
    '--chroma': '100%',
  },
  '[data-chroma="neutral"]': {
    '--chroma': '0%',
  },
});
