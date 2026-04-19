import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';

export const Svg = styled(
  'svg',
  {},
  {
    defaultProps: {
      className: 'icon',
      xmlns: 'http://www.w3.org/2000/svg',
    },
  }
);
export type SvgProps = ComponentProps<typeof Svg>;
