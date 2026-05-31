import { styled } from '@/styled-system/jsx';
import { badge } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Badge = styled('span', badge);
export type BadgeProps = ComponentProps<typeof Badge>;
