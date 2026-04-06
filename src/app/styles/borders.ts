import { defineTokens } from '@pandacss/dev';

export const borders = defineTokens.borders({
  divider: {
    DEFAULT: { value: '1px solid {colors.divider}' },
    thin: { value: '0.5px solid {colors.divider}' },
  },
  border: {
    DEFAULT: { value: '1px solid {colors.border}' },
    thin: { value: '0.5px solid {colors.border}' },
  },
  edge: {
    DEFAULT: { value: '1px solid {colors.edge}' },
    thin: { value: '0.5px solid {colors.edge}' },
  },
  focus: {
    DEFAULT: { value: '1px solid {colors.focus}' },
    thin: { value: '0.5px solid {colors.focus}' },
  },
});
