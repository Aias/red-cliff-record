import { Button as BaseButton } from '@base-ui/react/button';
import { styled } from '@/styled-system/jsx';
import { button } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Button = styled(BaseButton, button, {
  defaultProps: {
    type: 'button',
    'data-slot': 'button',
  },
});
export type ButtonProps = ComponentProps<typeof Button>;
