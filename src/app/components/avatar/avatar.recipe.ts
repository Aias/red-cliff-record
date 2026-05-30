import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const avatarRecipe = defineSlotRecipe({
  className: 'avatar',
  slots: ['root', 'image', 'fallback'],
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      boxSize: '[1.4em]',
      flexShrink: '0',
      overflow: 'hidden',
    },
    image: {
      aspectRatio: '1',
      boxSize: 'full',
      borderRadius: 'inherit',
      objectFit: 'cover',
    },
    fallback: {
      display: 'flex',
      boxSize: 'full',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'inherit',
      borderWidth: '1px',
      borderColor: 'mist',
      backgroundColor: 'splash',
      fontSize: '[1em]',
      fontWeight: 'medium',
    },
  },
  variants: {
    rounded: {
      true: {
        root: {
          borderRadius: 'full',
        },
      },
      false: {
        root: {
          borderRadius: 'sm',
        },
      },
    },
  },
  defaultVariants: {
    rounded: false,
  },
});
