import { defineRecipe } from '@/app/styles/define-recipe';

export const separatorRecipe = defineRecipe({
  className: 'separator',
  base: {
    flexShrink: '0',
    _horizontal: {
      height: 'px',
      width: 'full',
    },
    _vertical: {
      height: 'full',
      width: 'px',
    },
  },
  variants: {
    salience: {
      divider: {
        backgroundColor: 'divider',
      },
      border: {
        backgroundColor: 'border',
      },
      edge: {
        backgroundColor: 'edge',
      },
    },
  },
  defaultVariants: {
    salience: 'divider',
  },
});
