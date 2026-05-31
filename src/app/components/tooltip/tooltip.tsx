import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { createStyleContext } from '@/styled-system/jsx';
import { tooltip } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(tooltip);

export function Provider({ delay = 300, ...props }: BaseTooltip.Provider.Props) {
  return <BaseTooltip.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

export function Root(props: BaseTooltip.Root.Props) {
  return <BaseTooltip.Root data-slot="tooltip" {...props} />;
}

export function Trigger(props: BaseTooltip.Trigger.Props) {
  return <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props} />;
}

const StyledPositioner = withProvider(BaseTooltip.Positioner, 'positioner', {
  defaultProps: { 'data-slot': 'tooltip-positioner' },
});
const StyledPopup = withContext(BaseTooltip.Popup, 'popup', {
  defaultProps: { 'data-slot': 'tooltip-content' },
});
const StyledArrow = withContext(BaseTooltip.Arrow, 'arrow', {
  defaultProps: { 'data-slot': 'tooltip-arrow' },
});

type PositionerProps = Pick<
  BaseTooltip.Positioner.Props,
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
    <BaseTooltip.Portal>
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
    </BaseTooltip.Portal>
  );
}
