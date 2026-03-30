import { definePreset } from '@pandacss/dev';

export const conditionsPreset = definePreset({
  name: 'conditions',
  conditions: {
    extend: {
      childIcon: '& :where(svg, .icon, .lucide)',
    },
  },
});
