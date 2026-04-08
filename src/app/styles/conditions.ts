import { definePreset } from '@pandacss/dev';

export const conditionsPreset = definePreset({
  name: 'conditions',
  conditions: {
    extend: {
      dark: ':where([data-color-scheme="dark"], [data-dark], .dark) &',
      light: ':where([data-color-scheme="light"], [data-light], .light) &',
      neutral: ':where([data-chroma="neutral"], [data-neutral], .neutral) &',
      chromatic: '&[data-chromatic], :where([data-chromatic]) &',
      childIcon: '& :where(svg, .icon, .lucide)',
    },
  },
});
