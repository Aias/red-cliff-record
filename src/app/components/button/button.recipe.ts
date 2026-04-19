import { defineRecipe } from '@/app/styles/define-recipe';

export const buttonRecipe = defineRecipe({
  className: 'button',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    whiteSpace: 'nowrap',
    flexShrink: '0',
    outlineStyle: 'none',
    letterSpacing: '1%',
    borderRadius: 'md',
    borderWidth: '1px',
    borderColor: 'transparent',
    fontSize: 'sm',
    fontWeight: 'medium',
    transition: 'all',
    userSelect: 'none',
    cursor: 'pointer',
    _disabled: {
      pointerEvents: 'none',
      opacity: '50%',
    },
    _childIcon: {
      flexShrink: '0',
      boxSize: '[1.15em]',
    },
    _invalid: {
      colorPalette: 'error',
    },
    _focusVisible: {
      borderColor: 'focus',
      outlineColor: 'focus/50',
      outlineOffset: '0.5',
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
  },
  variants: {
    variant: {
      solid: {
        backgroundColor: 'main',
        color: 'mainContrast',
        boxShadow: 'xs',
        _hover: {
          backgroundColor: 'mainActive',
        },
      },
      soft: {
        backgroundColor: 'splash',
        color: 'primary',
        borderColor: 'divider/50',
        boxShadow: 'xs',
        _childIcon: {
          color: 'symbol',
        },
        _hover: {
          backgroundColor: 'flood',
          color: 'display',
        },
      },
      outline: {
        borderColor: 'border',
        backgroundColor: 'transparent',
        boxShadow: 'xs',
        color: 'accent',
        _childIcon: {
          color: 'symbol',
        },
        _hover: {
          backgroundColor: 'mist',
          color: 'accentActive',
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'accent',
        _childIcon: {
          color: 'symbol',
        },
        _hover: {
          backgroundColor: 'mist',
          color: 'accentActive',
          _childIcon: {
            color: 'primary',
          },
        },
      },
    },
    size: {
      default: {
        height: '9',
        paddingInline: '4',
        paddingBlock: '2',
        '&:has(svg)': {
          paddingInline: '3',
        },
      },
      sm: {
        height: '8',
        paddingInline: '3',
        paddingBlock: '0',
        borderRadius: 'md',
        gap: '1.5',
        fontSize: 'xs',
        '&:has(svg)': {
          paddingInline: '2.5',
        },
      },
      icon: {
        boxSize: '9',
      },
      'icon-sm': {
        boxSize: '6',
      },
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'default',
  },
});
