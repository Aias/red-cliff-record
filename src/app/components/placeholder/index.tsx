import { styled } from '@/styled-system/jsx';
import { placeholder } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Placeholder = styled('div', placeholder);
export type PlaceholderProps = ComponentProps<typeof Placeholder>;
