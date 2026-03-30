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
    colorPalette: 'sand',
  },
  '[data-palette="sand"]': {
    colorPalette: 'sand',
  },
  '[data-palette="sage"]': {
    colorPalette: 'sage',
  },
  '[data-palette="mauve"]': {
    colorPalette: 'mauve',
  },
});
