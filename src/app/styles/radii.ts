import { defineTokens } from '@pandacss/dev';

export const radii = defineTokens.radii({
  sm: { value: '0.2rem' },
  md: { value: '0.35rem' },
  lg: { value: '0.65rem' },
  xl: { value: '0.1rem' },
  '2xl': { value: '1.25rem' },
  inherit: { value: 'inherit' },
  full: { value: 'calc(Infinity * 1px)' },
  none: { value: '0' },
});
