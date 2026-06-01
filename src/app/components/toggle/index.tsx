import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { styled } from '@/styled-system/jsx';
import { toggle } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

export const Toggle = styled(BaseToggle, toggle);
export type ToggleProps = ComponentProps<typeof Toggle>;
