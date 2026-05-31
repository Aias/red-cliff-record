import { defineConfig } from '@pandacss/dev';
import { alertDialogRecipe } from '@/app/components/alert-dialog/alert-dialog.recipe';
import { avatarRecipe } from '@/app/components/avatar/avatar.recipe';
import { badgeRecipe } from '@/app/components/badge/badge.recipe';
import { buttonRecipe } from '@/app/components/button/button.recipe';
import { cardRecipe } from '@/app/components/card/card.recipe';
import { dialogRecipe } from '@/app/components/dialog/dialog.recipe';
import { dropdownMenuRecipe } from '@/app/components/dropdown-menu/dropdown-menu.recipe';
import { hoverCardRecipe } from '@/app/components/hover-card/hover-card.recipe';
import { inputRecipe, ghostInputRecipe } from '@/app/components/input/input.recipe';
import { labelRecipe } from '@/app/components/label/label.recipe';
import { placeholderRecipe } from '@/app/components/placeholder/placeholder.recipe';
import { popoverRecipe } from '@/app/components/popover/popover.recipe';
import { proseRecipe } from '@/app/components/prose/prose.recipe';
import { separatorRecipe } from '@/app/components/separator/separator.recipe';
import { tableRecipe } from '@/app/components/table/table.recipe';
import { textareaRecipe } from '@/app/components/textarea/textarea.recipe';
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
import { scrollAreaRecipe } from '@/components/scroll-area/scroll-area.recipe';

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
      badge: badgeRecipe,
      button: buttonRecipe,
      card: cardRecipe,
      input: inputRecipe,
      ghostInput: ghostInputRecipe,
      label: labelRecipe,
      placeholder: placeholderRecipe,
      prose: proseRecipe,
      separator: separatorRecipe,
      textarea: textareaRecipe,
    },
    slotRecipes: {
      alertDialog: alertDialogRecipe,
      avatar: avatarRecipe,
      dialog: dialogRecipe,
      dropdownMenu: dropdownMenuRecipe,
      hoverCard: hoverCardRecipe,
      popover: popoverRecipe,
      scrollArea: scrollAreaRecipe,
      table: tableRecipe,
      tooltip: tooltipRecipe,
    },
  },
  utilities: utilities,
});
