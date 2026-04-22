import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const tooltipRecipe = defineSlotRecipe({
  className: 'tooltip',
  slots: ['positioner', 'popup', 'arrow'],
  base: {
    positioner: {
      isolation: 'isolate',
      zIndex: '50',
    },
    popup: {
      zIndex: '50',
      width: '[fit-content]',
      maxWidth: '[50vw]',
      transformOrigin: 'var(--transform-origin)',
      borderRadius: 'md',
      backgroundColor: 'float',
      mode: 'dark',
      paddingInline: '3',
      paddingBlock: '1.5',
      textStyle: 'xs',
      color: 'primary',
      boxShadow: 'md',
      _dark: {
        border: 'divider',
      },
      _open: {
        animateIn: true,
        fadeIn: 0,
        zoomIn: 0.95,
      },
      _closed: {
        animateOut: true,
        fadeOut: 0,
        zoomOut: 0.95,
      },
      '&[data-side=bottom]': { slideInY: '-0.5rem' },
      '&[data-side=top]': { slideInY: '0.5rem' },
      '&[data-side=left]': { slideInX: '0.5rem' },
      '&[data-side=right]': { slideInX: '-0.5rem' },
      '&[data-side=inline-start]': { slideInX: '0.5rem' },
      '&[data-side=inline-end]': { slideInX: '-0.5rem' },
    },
    arrow: {
      boxSize: '2.5',
      translate: '[0 calc(-50% - 2px)]',
      rotate: '[45deg]',
      borderRadius: '[2px]',
      backgroundColor: 'float',
      _dark: {
        borderColor: 'border',
        borderStyle: 'solid',
        borderBlockEndWidth: '1px',
        borderInlineEndWidth: '1px',
      },
      '&[data-side=bottom]': {
        insetBlockStart: '1',
      },
      '&[data-side=top]': {
        insetBlockEnd: '-2.5',
      },
      '&[data-side=left]': {
        insetBlockStart: '[50% !important]',
        insetInlineEnd: '-1',
        translate: '[0 -50%]',
      },
      '&[data-side=right]': {
        insetBlockStart: '[50% !important]',
        insetInlineStart: '-1',
        translate: '[0 -50%]',
      },
      '&[data-side=inline-end]': {
        insetBlockStart: '[50% !important]',
        insetInlineStart: '-1',
        translate: '[0 -50%]',
      },
      '&[data-side=inline-start]': {
        insetBlockStart: '[50% !important]',
        insetInlineEnd: '-1',
        translate: '[0 -50%]',
      },
    },
  },
});
