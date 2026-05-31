import { Input as BaseInput } from '@base-ui/react/input';
import { styled } from '@/styled-system/jsx';
import { input, ghostInput } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Input = styled(BaseInput, input);
export type InputProps = ComponentProps<typeof Input>;

export const GhostInput = styled(BaseInput, ghostInput);
export type GhostInputProps = ComponentProps<typeof GhostInput>;
