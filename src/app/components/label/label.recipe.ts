import { defineRecipe } from '@/app/styles/define-recipe';

export const labelRecipe = defineRecipe({
  className: 'label',
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    fontSize: 'sm',
    fontWeight: 'medium',
    userSelect: 'none',
    _groupDisabled: {
      pointerEvents: 'none',
      opacity: '50%',
    },
    _peerDisabled: {
      opacity: '50%',
      cursor: 'not-allowed',
    },
  },
});
