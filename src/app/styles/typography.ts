import { defineTokens } from '@pandacss/dev';

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
