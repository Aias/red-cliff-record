import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const tooltipRecipe = defineSlotRecipe({
  className: 'tooltip',
  slots: ['root', 'trigger', 'positioner', 'popup', 'arrow'],
  base: {
    root: {},
    trigger: {},
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
      _sideBottom: { slideInY: '-0.5rem' },
      _sideTop: { slideInY: '0.5rem' },
      _sideLeft: { slideInX: '0.5rem' },
      _sideRight: { slideInX: '-0.5rem' },
      _sideInlineStart: { slideInX: '0.5rem' },
      _sideInlineEnd: { slideInX: '-0.5rem' },
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
      _sideBottom: {
        insetBlockStart: '1',
      },
      _sideTop: {
        insetBlockEnd: '-2.5',
      },
      _sideLeft: {
        insetBlockStart: '[50% !important]',
        insetInlineEnd: '-1',
        translateCenter: 'y',
      },
      _sideRight: {
        insetBlockStart: '[50% !important]',
        insetInlineStart: '-1',
        translateCenter: 'y',
      },
      _sideInlineEnd: {
        insetBlockStart: '[50% !important]',
        insetInlineStart: '-1',
        translateCenter: 'y',
      },
      _sideInlineStart: {
        insetBlockStart: '[50% !important]',
        insetInlineEnd: '-1',
        translateCenter: 'y',
      },
    },
  },
});
