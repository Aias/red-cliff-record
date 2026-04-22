import { Tooltip } from 'radix-ui';
import { createStyleContext } from '@/styled-system/jsx';
import { tooltip } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(tooltip);

export function Provider({ delayDuration = 300, ...props }: Tooltip.TooltipProviderProps) {
  return <Tooltip.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

export const Root = withProvider(Tooltip.Root, 'root', {
  defaultProps: {
    'data-slot': 'tooltip',
  },
});
export const Trigger = withContext(Tooltip.Trigger, 'trigger', {
  defaultProps: {
    'data-slot': 'tooltip-trigger',
  },
});
export const Portal = Tooltip.Portal;

const StyledContent = withContext(Tooltip.Content, 'content', {
  defaultProps: {
    'data-slot': 'tooltip-content',
  },
});
const StyledArrow = withContext(Tooltip.Arrow, 'arrow', {
  defaultProps: {
    'data-slot': 'tooltip-arrow',
  },
});

export const Content = ({
  sideOffset = 0,
  children,
  ...props
}: ComponentProps<typeof Tooltip.Content>) => {
  return (
    <Portal>
      <StyledContent sideOffset={sideOffset} {...props}>
        {children}
        <StyledArrow />
      </StyledContent>
    </Portal>
  );
};
