import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const dialogRecipe = defineSlotRecipe({
  className: 'dialog',
  slots: [
    'root',
    'trigger',
    'backdrop',
    'popup',
    'header',
    'footer',
    'title',
    'description',
    'close',
  ],
  base: {
    backdrop: {
      position: 'fixed',
      inset: '0',
      zIndex: '50',
      backgroundColor: 'black/30',
      backdropBlur: '[1px]',
      backdropFilter: 'auto',
      animationDuration: '100',
      animationTimingFunction: 'easeOut.expo',
      _open: {
        animationName: 'enter',
        fadeIn: 0,
      },
      _closed: {
        animationName: 'exit',
        fadeOut: 0,
      },
    },
    popup: {
      position: 'fixed',
      insetBlockStart: '1/2',
      insetInlineStart: '1/2',
      translateCenter: 'xy',
      zIndex: '50',
      display: 'grid',
      width: 'full',
      maxWidth: '[calc(100% - 2rem)]',
      sm: {
        maxWidth: '128',
      },
      gap: '4',
      borderRadius: 'lg',
      borderWidth: '1px',
      borderColor: 'divider',
      backgroundColor: 'float',
      padding: '6',
      boxShadow: 'lg',
      animationDuration: '200',
      animationTimingFunction: 'easeOut.expo',
      _open: {
        animationName: 'enter',
        zoomIn: 0.95,
        fadeIn: 0,
      },
      _closed: {
        animationName: 'exit',
        zoomOut: 0.95,
        fadeOut: 0,
      },
    },
    header: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2',
      textAlign: 'center',
      sm: {
        textAlign: 'left',
      },
    },
    footer: {
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '2',
      sm: {
        flexDirection: 'row',
        justifyContent: 'end',
      },
    },
    title: {
      textStyle: 'lg',
      lineHeight: 'none',
      fontWeight: 'semibold',
    },
    description: {
      textStyle: 'sm',
      color: 'secondary',
    },
    close: {
      position: 'absolute',
      insetBlockStart: '5',
      insetInlineEnd: '5',
      borderRadius: 'sm',
      lineHeight: 'none',
      opacity: '70%',
      outlineStyle: 'none',
      transitionProperty: '[opacity]',
      transitionDuration: '150',
      transitionTimingFunction: 'easeOut.cubic',
      _childIcon: {
        boxSize: '4',
      },
      _hover: {
        opacity: '100%',
      },
      _focusVisible: {
        outlineColor: 'focus/50',
        outlineOffset: '0.5',
        outlineStyle: 'solid',
        outlineWidth: '2px',
      },
      _disabled: {
        pointerEvents: 'none',
      },
    },
  },
});
