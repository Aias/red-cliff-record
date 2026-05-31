import { defineRecipe } from '@/app/styles/define-recipe';

export const inputRecipe = defineRecipe({
  className: 'input',
  base: {
    display: 'flex',
    height: '9',
    width: 'full',
    minWidth: '0',
    borderRadius: 'md',
    borderWidth: '1px',
    borderColor: 'border',
    backgroundColor: 'transparent',
    paddingInline: '3',
    paddingBlock: '1',
    textStyle: 'sm',
    color: 'display',
    boxShadow: 'xs',
    transitionProperty: '[color, box-shadow]',
    transitionDuration: '150',
    transitionTimingFunction: 'easeOut.cubic',
    outline: 'none',
    _placeholder: {
      color: 'muted',
    },
    _active: {
      borderColor: 'edge',
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
    _invalid: {
      layerStyle: 'chromatic',
      colorPalette: 'error',
    },
    _selection: {
      backgroundColor: 'main',
      color: 'mainContrast',
    },
    _file: {
      display: 'inline-flex',
      height: '7',
      borderWidth: '0',
      backgroundColor: 'transparent',
      textStyle: 'sm',
      fontWeight: 'medium',
      color: 'primary',
    },
  },
});

export const ghostInputRecipe = defineRecipe({
  className: 'ghost-input',
  base: {
    width: 'full',
    border: 'none',
    backgroundColor: 'transparent',
    padding: '0',
    margin: '0',
    font: 'inherit',
    outline: 'none',
    transition: 'colors',
    _placeholder: {
      color: 'muted',
    },
    _disabled: {
      opacity: '50%',
    },
  },
});
