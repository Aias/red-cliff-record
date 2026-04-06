import { Button as BaseButton } from '@base-ui/react/button';
import { Link } from '@tanstack/react-router';
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

export const LinkButton = styled(Link, button, {
  defaultProps: {
    'data-slot': 'button',
  },
});

export const AnchorButton = styled('a', button, {
  defaultProps: {
    'data-slot': 'button',
  },
});
