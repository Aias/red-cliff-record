import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const scrollAreaRecipe = defineSlotRecipe({
  className: 'scroll-area',
  slots: ['root', 'viewport', 'content', 'scrollbar', 'corner', 'thumb'],
  base: {
    root: {
      position: 'relative',
    },
    viewport: {
      boxSize: 'full',
      borderRadius: 'inherit',
      transitionProperty: '[color, box-shadow]',
      outline: 'none',
      _focusVisible: {
        focusRingWidth: '2px',
        focusRingColor: 'focus/50',
        focusVisibleRing: 'outside',
      },
    },
    content: {},
    scrollbar: {
      display: 'flex',
      touchAction: 'none',
      padding: 'px',
      transitionProperty: 'colors',
      transitionDuration: '150',
      transitionTimingFunction: 'easeOut.cubic',
      userSelect: 'none',
    },
    corner: {},
    thumb: {
      position: 'relative',
      flex: '1',
      borderRadius: 'full',
      backgroundColor: 'divider',
    },
  },
  variants: {
    orientation: {
      vertical: {
        scrollbar: {
          height: 'full',
          width: '2.5',
          borderInlineStartWidth: '1px',
          borderInlineStartColor: 'transparent',
        },
      },
      horizontal: {
        scrollbar: {
          height: '2.5',
          flexDirection: 'column',
          borderBlockStartWidth: '1px',
          borderBlockStartColor: 'transparent',
        },
      },
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});
