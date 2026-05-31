import { defineSlotRecipe } from '@/app/styles/define-recipe';

// Horizontal orientation lays the list out as a single [auto, 1fr] grid so every
// row shares column widths; each item is a subgrid row that inherits those tracks.
// Vertical orientation stacks items as flex columns with label above value.
export const dataListRecipe = defineSlotRecipe({
  className: 'data-list',
  slots: ['root', 'item', 'label', 'value'],
  base: {
    root: {
      overflowWrap: 'break-word',
      textStyle: 'sm',
      textAlign: 'left',
      fontStyle: 'normal',
      fontWeight: 'normal',
    },
    item: {},
    label: {},
    value: {},
  },
  variants: {
    orientation: {
      horizontal: {
        root: {
          display: 'grid',
          gridTemplateColumns: '[auto 1fr]',
          columnGap: '4',
          rowGap: '2',
        },
        item: {
          display: 'grid',
          gridTemplateColumns: 'subgrid',
          gridColumn: '1 / -1',
        },
      },
      vertical: {
        root: {
          display: 'flex',
          flexDirection: 'column',
          gap: '2',
        },
        item: {
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
        },
      },
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
  },
});
