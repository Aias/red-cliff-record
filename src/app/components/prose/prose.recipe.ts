import { defineRecipe } from '@/app/styles/define-recipe';

export const proseRecipe = defineRecipe({
  className: 'prose',
  base: {
    '& :where(p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, hr, table, dl, dt, dd, div, figure, figcaption)':
      {
        marginBlock: '[0.5lh]',
        _first: {
          marginBlockStart: '0',
        },
        _last: {
          marginBlockEnd: '0',
        },
      },
    '& :is(h1, h2, h3, h4, h5, h6)': {
      marginBlockStart: '[0.75lh]',
      marginBlockEnd: '[0.25lh]',
    },
    '& :is(ul)': {
      listStyleType: 'circle',
    },
    '& :is(ol)': {
      listStyleType: 'decimal',
    },
    '& :is(li)': {
      marginBlock: '[0.25lh]',
      _marker: {
        color: 'currentColor',
        backgroundColor: 'transparent',
      },
    },
    '& :is(ul, ol)': {
      paddingInlineStart: '[3ch]',
    },
    '& :is(blockquote)': {
      position: 'relative',
      marginBlock: '[0.75lh]',
      paddingBlock: '0.5',
      paddingInlineStart: '3.5',
      fontStyle: 'italic',
      _before: {
        content: '""',
        position: 'absolute',
        display: 'block',
        insetBlock: '0',
        insetInlineStart: '0',
        width: '1',
        borderRadius: 'sm',
        backgroundColor: 'flood',
      },
    },
    '& :is(pre)': {
      padding: '2',
      backgroundColor: 'mist',
      borderColor: 'divider/50',
      borderWidth: 'thin',
      borderStyle: 'solid',
      borderRadius: 'md',
      overflowX: 'auto',
      fontSize: '[0.925em]',
    },
    '& :not(pre) :is(code, kbd, samp)': {
      backgroundColor: 'splash',
      paddingInline: '0.5',
      paddingBlock: '0.25',
      borderRadius: 'md',
      fontSize: '[0.925em]',
    },
  },
});
