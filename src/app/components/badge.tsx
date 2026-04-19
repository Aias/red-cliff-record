import { styled } from '@/styled-system/jsx';

/**
 * The badgeVariants uses relative units (em) so that the padding and border-radius
 * scale with the font-size (which you can control with Tailwind’s text-[size] utilities).
 *
 * The four variants correspond to the Radix badge variants. Compound variants are used
 * to adjust the high-contrast settings based on the `highContrast` prop.
 */
export const Badge = styled('span', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexShrink: '0',
    fontWeight: 'medium',
    transition: 'colors',
    fontSize: '[0.875em]',
    borderWidth: '1px',
    borderColor: 'transparent',
    paddingInline: '[0.5em]',
    paddingBlock: '[0.21em]',
    borderRadius: '[0.25em]',
  },
  variants: {
    variant: {
      solid: {
        backgroundColor: 'main',
        color: 'mainContrast',
      },
      soft: {
        backgroundColor: 'splash',
        color: 'accent',
      },
      outline: {
        borderColor: 'border',
        color: 'primary',
      },
    },
  },
  defaultVariants: {
    variant: 'soft',
  },
});
