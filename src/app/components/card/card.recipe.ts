import { defineRecipe } from '@/app/styles/define-recipe';

export const cardRecipe = defineRecipe({
  className: 'card',
  base: {
    position: 'relative',
    display: 'block',
    overflow: 'hidden',
    borderRadius: 'md',
    border: 'divider',
    backgroundColor: 'surface',
  },
  variants: {
    compact: {
      true: { paddingInline: '3', paddingBlock: '2', textStyle: 'sm' },
      false: { padding: '4' },
    },
  },
  defaultVariants: { compact: false },
});
