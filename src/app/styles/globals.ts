import { defineGlobalStyles } from '@pandacss/dev';
import { neutralLayerStyleValue } from '@/app/styles/colors';

export const globalStyles = defineGlobalStyles({
  html: {
    '--global-font-body': 'fonts.sans',
    '--global-font-mono': 'fonts.mono',
    '--global-color-border': 'colors.divider',
    '--global-color-placeholder': 'colors.muted',
    '--global-color-selection': 'colors.splash',
    '--global-color-focus-ring': 'colors.focus',
    scrollbarWidth: 'thin',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    fontSynthesis: 'none',
    fontVariantLigatures: 'common-ligatures',
    fontVariantNumeric: 'tabular-nums',
    height: '100dvh',
    width: '100dvw',
    backgroundColor: '{colors.background}',
    color: '{colors.primary}',
    accentColor: '{colors.accent}',
    '&[data-theme-transitioning] :where(*, *::before, *::after)': {
      transitionDuration: '0s !important',
      transitionDelay: '0s !important',
    },
  },
  body: {
    position: 'relative',
    boxSize: '{sizes.full}',
    backgroundColor: '{colors.background}',
  },
  '.root': {
    isolation: 'isolate',
    boxSize: '{sizes.full}',
  },
  'h1, .h1': {
    textStyle: '2xl',
    fontWeight: 'semibold',
  },
  'h2, .h2': {
    textStyle: 'xl',
    fontWeight: 'medium',
  },
  'h3, .h3': {
    textStyle: 'lg',
    fontWeight: 'medium',
  },
  'h4, .h4': {
    textStyle: 'base',
    fontWeight: 'medium',
  },
  'h5, .h5, h6, .h6': {
    textStyle: 'sm',
    fontWeight: 'semibold',
  },
  hr: {
    margin: '0',
    display: 'block',
    width: '100%',
    border: 'none',
    borderColor: 'transparent',
    backgroundColor: '{colors.divider}',
    height: '1px',
  },
  'pre, code': {
    fontFamily: '{fonts.mono}',
  },
  'b, strong': {
    fontWeight: 'medium',
  },
  '::marker, mark': {
    backgroundColor: '{colors.mist}',
    color: '{colors.accent}',
  },
  'a:any-link:not(.button, .rcr-button), .link': {
    fontWeight: 'medium',
    color: '{colors.accent}',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    transitionProperty: 'color, text-decoration-color',
    transitionDuration: '150ms',
    _hover: {
      color: '{colors.accentActive}',
      textDecorationColor: 'color-mix(in oklch, {colors.accentActive} 50%, transparent)',
    },
    textDecorationThickness: 'clamp(1px, 0.05em, 2px)',
    textUnderlineOffset: 'calc(0.025em + 2px)',
    textDecorationSkipInk: 'auto',
    '&:has(.icon, .lucide)': {
      display: 'inline-flex',
      gap: '{spacing.1}',
      alignItems: 'center',
    },
  },
  '.icon, .lucide': {
    display: 'inline-flex',
    aspectRatio: '1',
    boxSize: '1em',
    flexShrink: '0',
    lineHeight: '1',
    color: 'currentColor',
  },
  'input[type="text"]::-webkit-calendar-picker-indicator': {
    display:
      'none !important' /* https://stackoverflow.com/questions/23177409/remove-arrow-in-chrome-for-input-with-attribute-list */,
  },
  ':root': {
    colorScheme: 'light dark',
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
  // When palette changes via data attribute, reset generic tokens to neutral.
  // Uses :where() for zero specificity so layerStyle classes can override.
  ':where([data-palette])': neutralLayerStyleValue,
  '[data-color-scheme="dark"], .dark': {
    colorScheme: 'dark',
    '--inverse-color-scheme': 'light',
  },
  '[data-color-scheme="light"], .light': {
    colorScheme: 'light',
    '--inverse-color-scheme': 'dark',
  },
});
