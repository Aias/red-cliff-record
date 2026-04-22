import { styled } from '@/styled-system/jsx';

export const Card = styled('div', {
  base: {
    position: 'relative',
    display: 'block',
    overflow: 'hidden',
    borderRadius: 'md',
    border: 'divider',
    backgroundColor: 'surface',
  },
  variants: {
    compact: {
      true: { paddingInline: '3', paddingBlock: '2', textStyle: 'sm' },
      false: { padding: '4' },
    },
  },
  defaultVariants: { compact: false },
});
