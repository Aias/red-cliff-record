import { defineTokens } from '@pandacss/dev';

export const radii = defineTokens.radii({
  sm: { value: '0.125rem' },
  md: { value: '0.25rem' },
  lg: { value: '0.5rem' },
  xl: { value: '0.75rem' },
  '2xl': { value: '1rem' },
  inherit: { value: 'inherit' },
  full: { value: 'calc(Infinity * 1px)' },
  none: { value: '0' },
});
