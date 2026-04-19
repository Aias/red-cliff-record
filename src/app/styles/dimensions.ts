import { defineTokens } from '@pandacss/dev';

const SHARED_DIMENSIONS = [
  0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20,
  24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
];

const BASE = '0.25rem';

const SHARED_TOKENS = SHARED_DIMENSIONS.reduce(
  (acc, value) => {
    acc[value] = { value: `calc(${value} * ${BASE})` };
    return acc;
  },
  {} as Record<number, { value: string }>
);

const ADDITIONAL_TOKENS = {
  '1/5': { value: '20%' },
  '1/4': { value: '25%' },
  '1/3': { value: 'calc(1/3 * 100%)' },
  '2/5': { value: '40%' },
  '1/2': { value: '50%' },
  '3/5': { value: '60%' },
  '2/3': { value: 'calc(2/3 * 100%)' },
  '3/4': { value: '75%' },
  '4/5': { value: '80%' },
  full: { value: '100%' },
  em: { value: '1em' },
  px: { value: '1px' },
};

export const spacing = defineTokens.spacing({
  ...SHARED_TOKENS,
  ...ADDITIONAL_TOKENS,
});

export const sizes = defineTokens.sizes({
  ...SHARED_TOKENS,
  ...ADDITIONAL_TOKENS,
  prose: { value: '65ch' },
});
