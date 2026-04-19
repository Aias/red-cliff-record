import { Separator as BaseSeparator } from '@base-ui/react';
import { styled } from '@/styled-system/jsx';

export const Separator = styled(
  BaseSeparator,
  {
    base: {
      flexShrink: '0',
      _horizontal: {
        height: 'px',
        width: 'full',
      },
      _vertical: {
        height: 'full',
        width: 'px',
      },
    },
    variants: {
      salience: {
        divider: {
          backgroundColor: 'divider',
        },
        border: {
          backgroundColor: 'border',
        },
        edge: {
          backgroundColor: 'edge',
        },
      },
    },
  },
  {
    defaultProps: {
      orientation: 'horizontal',
      salience: 'divider',
    },
  }
);
