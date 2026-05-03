import { defineConfig } from '@pandacss/dev';
import { alertDialogRecipe } from '@/app/components/alert-dialog/alert-dialog.recipe';
import { buttonRecipe } from '@/app/components/button/button.recipe';
import { textareaRecipe } from '@/app/components/field/textarea.recipe';
import { tableRecipe } from '@/app/components/table/table.recipe';
import { tooltipRecipe } from '@/app/components/tooltip/tooltip.recipe';
import { easings, durations, keyframes } from '@/app/styles/animations';
import { blurs } from '@/app/styles/blurs';
import { borders } from '@/app/styles/borders';
import { colors, semanticColors } from '@/app/styles/colors';
import { conditionsPreset } from '@/app/styles/conditions';
import { PREFIX } from '@/app/styles/constants';
import { spacing, sizes } from '@/app/styles/dimensions';
import { globalStyles } from '@/app/styles/globals';
import { utilities } from '@/app/styles/plugins';
import { radii } from '@/app/styles/radii';
import { shadows } from '@/app/styles/shadows';
import {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  textStyles,
} from '@/app/styles/typography';

export default defineConfig({
  preflight: true,
  jsxFramework: 'react',
  prefix: {
    className: PREFIX,
    cssVar: PREFIX,
  },
  include: ['./src/app/**/*.{js,jsx,ts,tsx}'],
  outdir: 'src/app/styled-system',

  strictPropertyValues: true,
  strictTokens: true,
  jsxStyleProps: 'minimal',
  shorthands: false,

  presets: [conditionsPreset],
  globalCss: globalStyles,
  staticCss: {
    css: [
      {
        properties: {
          layerStyle: ['chromatic', 'neutral'],
          palette: ['artifact', 'entity', 'concept', 'error', 'success', 'info'],
        },
      },
    ],
  },
  theme: {
    extend: {
      tokens: {
        blurs: blurs,
        borders: borders,
        colors: colors,
        durations: durations,
        easings: easings,
        fonts: fontFamilies,
        fontSizes: fontSizes,
        fontWeights: fontWeights,
        lineHeights: lineHeights,
        radii: radii,
        shadows: shadows,
        sizes: sizes,
        spacing: spacing,
      },
      semanticTokens: {
        colors: semanticColors,
      },
    },
    keyframes: keyframes,
    textStyles: textStyles,
    layerStyles: {
      // Empty declarations, only for autocomplete and class name generation
      chromatic: { value: {} },
      neutral: { value: {} },
    },
    breakpoints: {
      sm: '40rem',
      md: '48rem',
      lg: '64rem',
      xl: '80rem',
      '2xl': '96rem',
    },
    containerSizes: {
      sm: '40rem',
    },
    recipes: {
      button: buttonRecipe,
      textarea: textareaRecipe,
    },
    slotRecipes: {
      alertDialog: alertDialogRecipe,
      table: tableRecipe,
      tooltip: tooltipRecipe,
    },
  },
  utilities: utilities,
});
