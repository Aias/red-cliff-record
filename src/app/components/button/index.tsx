import { Button as BaseButton } from '@base-ui/react/button';
import { Link } from '@tanstack/react-router';
import { styled } from '@/styled-system/jsx';
import { button } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Button = styled(BaseButton, button, {
  defaultProps: {
    type: 'button',
  },
});
export type ButtonProps = ComponentProps<typeof Button>;

export const LinkButton = styled(Link, button);
export type LinkButtonProps = ComponentProps<typeof LinkButton>;

export const AnchorButton = styled('a', button);
export type AnchorButtonProps = ComponentProps<typeof AnchorButton>;
