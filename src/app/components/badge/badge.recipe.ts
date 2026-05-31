import { defineRecipe } from '@/app/styles/define-recipe';

export const badgeRecipe = defineRecipe({
  className: 'badge',
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
