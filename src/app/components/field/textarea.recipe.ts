import { defineRecipe } from '@/app/styles/define-recipe';

export const textareaRecipe = defineRecipe({
  className: 'textarea',
  base: {
    display: 'block',
    fieldSizing: 'content',
    width: 'full',
    borderRadius: 'md',
    borderWidth: '1px',
    borderColor: 'border',
    backgroundColor: 'transparent',
    paddingInline: '3',
    paddingBlock: '2',
    textStyle: 'sm',
    outline: 'none',
    color: 'display',
    transitionProperty: '[color, box-shadow]',
    transitionDuration: '150',
    transitionTimingFunction: 'easeOut.cubic',
    boxShadow: 'xs',
    _placeholder: {
      color: 'muted',
    },
    _invalid: {
      colorPalette: 'error',
    },
    _disabled: {
      opacity: '50%',
      pointerEvents: 'none',
      boxShadow: 'none',
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
    resize: {
      default: {
        minHeight: '16',
        resize: 'block',
        overflowY: 'auto',
        scrollbarWidth: '[thin]',
      },
      auto: {
        minHeight: '0',
        resize: 'none',
        overflow: 'hidden',
      },
    },
  },
  defaultVariants: {
    resize: 'default',
  },
});
