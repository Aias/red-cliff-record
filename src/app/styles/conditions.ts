import { definePreset } from '@pandacss/dev';

export const conditionsPreset = definePreset({
  name: 'conditions',
  conditions: {
    extend: {
      dark: ':where([data-color-scheme="dark"], .dark) &',
      light: ':where([data-color-scheme="light"], .light) &',
      neutral: ':where([data-chroma="neutral"]) &',
      chromatic: ':where([data-chroma="chromatic"]) &',
      childIcon: '& :where(svg, .icon, .lucide)',
    },
  },
});
