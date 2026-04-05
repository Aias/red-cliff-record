import { styled } from '@/styled-system/jsx';

export const Placeholder = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: '2',
    padding: '4',
    borderRadius: 'sm',
    borderWidth: '1px',
    borderColor: 'divider',
    backgroundColor: 'mist',
  },
});
