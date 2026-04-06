import { defineSlotRecipe } from '@/app/styles/define-recipe';

export const tableRecipe = defineSlotRecipe({
  className: 'table',
  slots: ['root', 'table', 'header', 'body', 'footer', 'row', 'head', 'cell', 'caption'],
  base: {
    root: {
      position: 'relative',
      overflowX: 'auto',
      width: 'full',
    },
    table: {
      width: 'full',
      borderCollapse: 'collapse',
      textStyle: 'sm',
      captionSide: 'bottom',
    },
    header: {
      '& tr': {
        borderBlockEnd: 'divider',
      },
    },
    body: {
      '& tr:last-child': {
        borderBlockEndWidth: '0',
      },
    },
    footer: {
      borderBlockStart: 'divider',
      backgroundColor: 'mist',
      fontWeight: 'medium',
      '& tr': {
        _last: {
          borderBlockEndWidth: '0',
        },
      },
    },
    row: {
      borderBlockEnd: 'divider',
      transition: 'colors',
      _hover: {
        backgroundColor: 'mist',
      },
      _selected: {
        backgroundColor: 'splash',
      },
    },
    head: {
      height: '10',
      paddingInline: '2',
      textAlign: 'left',
      verticalAlign: 'middle',
      fontWeight: 'medium',
      whiteSpace: 'nowrap',
      color: 'primary',
      '&:has([role=checkbox])': {
        paddingInlineEnd: '0',
      },
      '& [role=checkbox]': {
        translateY: '0.5',
      },
    },
    cell: {
      padding: '2',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      '&:has([role=checkbox])': {
        paddingInlineEnd: '0',
      },
      '& [role=checkbox]': {
        translateY: '0.5',
      },
    },
    caption: {
      marginBlockStart: '1',
      textStyle: 'sm',
      color: 'secondary',
    },
  },
});
