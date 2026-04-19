import { definePreset } from '@pandacss/dev';
import { PREFIX } from './constants';

export const conditionsPreset = definePreset({
  name: 'conditions',
  conditions: {
    extend: {
      dark: ':where([data-color-scheme="dark"], [data-dark], .dark) &',
      light: ':where([data-color-scheme="light"], [data-light], .light) &',
      neutral: `&[data-neutral], &.${PREFIX}-layerStyle_neutral, :where([data-neutral], [data-chroma="neutral"], .neutral, .${PREFIX}-layerStyle_neutral) &`,
      chromatic: `&[data-chromatic], &.${PREFIX}-layerStyle_chromatic, :where([data-chromatic], .${PREFIX}-layerStyle_chromatic) &`,
      childIcon: '& :where(svg, .icon, .lucide)',
    },
  },
});
