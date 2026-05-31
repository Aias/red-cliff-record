import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const radioCardsRecipe = defineSlotRecipe({
  className: 'radio-cards',
  slots: ['root', 'item'],
  base: {
    root: {},
    item: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '[max-content]',
      padding: '[0.75em]',
      textAlign: 'start',
      color: 'primary',
      backgroundColor: 'surface',
      borderRadius: 'md',
      borderWidth: '1px',
      borderColor: 'border',
      boxShadow: 'xs',
      outlineStyle: 'none',
      cursor: 'pointer',
      _hover: {
        backgroundColor: 'mist',
        color: 'display',
      },
      _focusVisible: {
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineColor: 'focus',
        outlineOffset: '-0.5',
      },
      _disabled: {
        cursor: 'not-allowed',
        opacity: '50%',
      },
      _checked: {
        backgroundColor: 'splash',
        borderColor: 'focus',
      },
    },
  },
});
