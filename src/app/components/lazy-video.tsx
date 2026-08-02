import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';

export const LazyVideo = styled(
  'video',
  {},
  {
    defaultProps: {
      preload: 'none',
    },
  }
);
export type LazyVideoProps = ComponentProps<typeof LazyVideo>;
