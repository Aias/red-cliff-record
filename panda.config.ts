import { defineConfig } from '@pandacss/dev';
import { easings, durations } from '@/app/styles/animations';
import { conditionsPreset } from '@/app/styles/conditions';
import { spacing, sizes } from '@/app/styles/dimensions';
import { globalStyles } from '@/app/styles/globals';
import { utilities } from '@/app/styles/plugins';
import { radii } from '@/app/styles/radii';
import { fontFamilies } from '@/app/styles/typography';

export default defineConfig({
  preflight: true,
  jsxFramework: 'react',
  prefix: {
    className: 'rcr',
    cssVar: 'rcr',
  },

  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  outdir: 'src/app/styled-system',

  strictPropertyValues: true,
  strictTokens: true,
  jsxStyleProps: 'minimal',
  shorthands: false,

  presets: [conditionsPreset],
  globalCss: globalStyles,
  theme: {
    extend: {
      tokens: {
        durations: durations,
        easings: easings,
        fonts: fontFamilies,
        radii: radii,
        sizes: sizes,
        spacing: spacing,
      },
    },
  },
  utilities: utilities,
});
