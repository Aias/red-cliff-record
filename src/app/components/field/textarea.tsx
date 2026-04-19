import { styled } from '@/styled-system/jsx';
import { textarea } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Textarea = styled('textarea', textarea);
export type TextareaProps = ComponentProps<typeof Textarea>;
