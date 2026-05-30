import { defineRecipe } from '@/app/styles/define-recipe';

export const placeholderRecipe = defineRecipe({
  className: 'placeholder',
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    gap: '2',
    padding: '4',
    borderRadius: 'md',
    borderWidth: '1px',
    borderColor: 'divider',
    backgroundColor: 'mist',
  },
});
