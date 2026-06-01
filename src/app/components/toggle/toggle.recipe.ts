import { defineRecipe } from '@/app/styles/define-recipe';

export const toggleRecipe = defineRecipe({
  className: 'toggle',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    flexShrink: '0',
    height: '9',
    minWidth: '9',
    paddingInline: '2',
    borderRadius: 'md',
    textStyle: 'sm',
    fontWeight: 'medium',
    whiteSpace: 'nowrap',
    color: 'secondary',
    outlineStyle: 'none',
    backgroundColor: 'transparent',
    transitionProperty: '[background-color, color, box-shadow]',
    transitionDuration: '150',
    transitionTimingFunction: 'easeOut.cubic',
    _hover: {
      backgroundColor: 'mist',
    },
    _pressed: {
      backgroundColor: 'splash',
      color: 'accent',
      layerStyle: 'chromatic',
    },
    _disabled: {
      pointerEvents: 'none',
      opacity: '50%',
      layerStyle: 'neutral',
    },
    _focusVisible: {
      borderColor: 'focus',
      outlineColor: 'focus/50',
      outlineOffset: '0.5',
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
    _childIcon: {
      pointerEvents: 'none',
      flexShrink: '0',
      boxSize: '4',
    },
  },
  variants: {
    variant: {
      default: {},
      outline: {
        borderWidth: '1px',
        borderColor: 'border',
        boxShadow: 'xs',
        _hover: {
          color: 'display',
        },
      },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
