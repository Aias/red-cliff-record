import { Separator as BaseSeparator } from '@base-ui/react';
import { styled } from '@/styled-system/jsx';
import { separator } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Separator = styled(BaseSeparator, separator, {
  defaultProps: {
    orientation: 'horizontal',
    salience: 'divider',
  },
});
export type SeparatorProps = ComponentProps<typeof Separator>;
