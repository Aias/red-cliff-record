import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const hoverCardRecipe = defineSlotRecipe({
  className: 'hoverCard',
  slots: ['root', 'trigger', 'positioner', 'popup'],
  base: {
    root: {},
    trigger: {},
    positioner: {
      isolation: 'isolate',
      zIndex: '50',
    },
    popup: {
      zIndex: '50',
      width: '64',
      transformOrigin: 'var(--transform-origin)',
      borderRadius: 'md',
      border: 'divider',
      backgroundColor: 'float',
      padding: '4',
      color: 'primary',
      boxShadow: 'md',
      outlineStyle: 'none',
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
    },
  },
});
