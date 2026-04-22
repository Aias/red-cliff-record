import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { createStyleContext } from '@/styled-system/jsx';
import { tooltip } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(tooltip);

export function Provider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

export function Root(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

export function Trigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

const StyledPositioner = withProvider(TooltipPrimitive.Positioner, 'positioner', {
  defaultProps: { 'data-slot': 'tooltip-positioner' },
});
const StyledPopup = withContext(TooltipPrimitive.Popup, 'popup', {
  defaultProps: { 'data-slot': 'tooltip-content' },
});
const StyledArrow = withContext(TooltipPrimitive.Arrow, 'arrow', {
  defaultProps: { 'data-slot': 'tooltip-arrow' },
});

type PositionerProps = Pick<
  TooltipPrimitive.Positioner.Props,
  | 'anchor'
  | 'positionMethod'
  | 'side'
  | 'sideOffset'
  | 'align'
  | 'alignOffset'
  | 'collisionBoundary'
  | 'collisionPadding'
  | 'sticky'
  | 'arrowPadding'
  | 'disableAnchorTracking'
  | 'collisionAvoidance'
>;

export function Content({
  anchor,
  positionMethod,
  side,
  sideOffset = 8,
  align,
  alignOffset,
  collisionBoundary,
  collisionPadding,
  sticky,
  arrowPadding,
  disableAnchorTracking,
  collisionAvoidance,
  children,
  ...props
}: ComponentProps<typeof StyledPopup> & PositionerProps) {
  return (
    <TooltipPrimitive.Portal>
      <StyledPositioner
        anchor={anchor}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        sticky={sticky}
        arrowPadding={arrowPadding}
        disableAnchorTracking={disableAnchorTracking}
        collisionAvoidance={collisionAvoidance}
      >
        <StyledPopup {...props}>
          {children}
          <StyledArrow />
        </StyledPopup>
      </StyledPositioner>
    </TooltipPrimitive.Portal>
  );
}
