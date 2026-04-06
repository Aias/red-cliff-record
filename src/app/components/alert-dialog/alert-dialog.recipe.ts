import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const alertDialogRecipe = defineSlotRecipe({
  className: 'alertDialog',
  slots: [
    'root',
    'trigger',
    'portal',
    'overlay',
    'content',
    'header',
    'footer',
    'title',
    'description',
    'action',
    'cancel',
  ],
  base: {
    overlay: {
      position: 'fixed',
      inset: '0',
      zIndex: '50',
      backgroundColor: 'black/50',
      animationDuration: '200',
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
    content: {
      position: 'fixed',
      insetBlockStart: '1/2',
      insetInlineStart: '1/2',
      translateCenter: 'xy',
      zIndex: '50',
      display: 'grid',
      width: 'full',
      maxWidth: '[calc(100%-2rem)]',
      sm: {
        maxWidth: '[32rem]',
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
      fontSize: 'lg',
      fontWeight: 'semibold',
    },
    description: {
      fontSize: 'sm',
      color: 'secondary',
    },
  },
});
