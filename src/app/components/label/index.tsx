import { styled } from '@/styled-system/jsx';
import { label } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Label = styled('label', label);
export type LabelProps = ComponentProps<typeof Label>;
