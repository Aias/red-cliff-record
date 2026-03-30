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
});
