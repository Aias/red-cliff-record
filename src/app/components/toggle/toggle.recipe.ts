import { defineRecipe } from '@/app/styles/define-recipe';

export const toggleRecipe = defineRecipe({
  className: 'toggle',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    borderRadius: 'md',
    textStyle: 'sm',
    fontWeight: 'medium',
    whiteSpace: 'nowrap',
    color: 'secondary',
    outlineStyle: 'none',
    borderWidth: '1px',
    borderColor: 'transparent',
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
    size: {
      default: {
        height: '9',
        minWidth: '9',
        paddingInline: '2',
        gap: '2',
        _childIcon: {
          boxSize: '4',
        },
      },
      sm: {
        height: '7',
        minWidth: '7',
        paddingInline: '1.5',
        gap: '1.5',
        _childIcon: {
          boxSize: '3.5',
        },
      },
    },
    variant: {
      default: {},
      outline: {
        borderColor: 'border',
        boxShadow: 'xs',
        _hover: {
          color: 'display',
        },
      },
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
  // Variants reach this recipe only through the ToggleGroup context wrapper (dynamic props),
  // so static extraction can't see them — force every variant to be generated.
  staticCss: ['*'],
});
