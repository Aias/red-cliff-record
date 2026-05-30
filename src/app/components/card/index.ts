import { styled } from '@/styled-system/jsx';
import { card } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Card = styled('div', card);
export type CardProps = ComponentProps<typeof Card>;
