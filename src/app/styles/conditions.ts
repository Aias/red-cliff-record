import { definePreset } from '@pandacss/dev';
import { PREFIX } from './constants';

export const conditionsPreset = definePreset({
  name: 'conditions',
  conditions: {
    extend: {
      // Override Panda's built-in disabled/active/selected so a literal `data-*=false`
      // does not trigger the condition. Libraries like cmdk render the boolean state on
      // every item (`data-disabled="false"`, `data-selected="false"`), and the stock
      // selectors match on attribute presence — flagging every item as disabled/selected.
      // Presence (Radix's valueless `data-disabled`) and `=true` still match.
      disabled:
        '&:is(:disabled, [disabled], [data-disabled]:not([data-disabled=false]), [aria-disabled=true])',
      active: '&:is(:active, [data-active]:not([data-active=false]))',
      selected: '&:is([aria-selected=true], [data-selected]:not([data-selected=false]))',
      dark: ':where([data-color-scheme="dark"], [data-dark], .dark) &',
      light: ':where([data-color-scheme="light"], [data-light], .light) &',
      neutral: `&[data-neutral], &.${PREFIX}-layerStyle_neutral, :where([data-neutral], [data-chroma="neutral"], .neutral, .${PREFIX}-layerStyle_neutral) &`,
      chromatic: `&[data-chromatic], &.${PREFIX}-layerStyle_chromatic, :where([data-chromatic], .${PREFIX}-layerStyle_chromatic) &`,
      childIcon: '& :where(svg, .icon, .lucide)',
      sideBottom: '&[data-side=bottom]',
      sideTop: '&[data-side=top]',
      sideLeft: '&[data-side=left]',
      sideRight: '&[data-side=right]',
      sideInlineStart: '&[data-side=inline-start]',
      sideInlineEnd: '&[data-side=inline-end]',
    },
  },
});
