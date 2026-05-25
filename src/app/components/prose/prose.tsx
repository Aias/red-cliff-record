import { styled } from '@/styled-system/jsx';
import { prose } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';
import { PolymorphicDiv } from '../polymorphic';

export const Prose = styled(PolymorphicDiv, prose);
export type ProseProps = ComponentProps<typeof Prose>;
