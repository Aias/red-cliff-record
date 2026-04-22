import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const tooltipRecipe = defineSlotRecipe({
  className: 'tooltip',
  slots: ['root', 'trigger', 'portal', 'content', 'arrow'],
  base: {
    content: {
      zIndex: '50',
      width: '[fit-content]',
      maxWidth: '[50vw]',
      transformOrigin: 'var(--radix-tooltip-content-transform-origin)',
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
      animateIn: true,
      fadeIn: 0,
      zoomIn: 0.95,
      _closed: { animateOut: true, fadeOut: 0, zoomOut: 0.95 },
      '&[data-side=bottom]': { slideInY: '-0.5rem' },
      '&[data-side=top]': { slideInY: '0.5rem' },
      '&[data-side=left]': { slideInX: '-0.5rem' },
      '&[data-side=right]': { slideInX: '0.5rem' },
    },
    arrow: {
      zIndex: '50',
      boxSize: '2.5',
      translateCenter: 'y',
      rotate: '[45deg]',
      borderRadius: 'sm',
      backgroundColor: 'float',
      fill: 'float',
      _dark: {
        borderColor: 'border',
        borderStyle: 'solid',
        borderBlockEndWidth: '1px',
        borderInlineEndWidth: '1px',
      },
    },
  },
});
