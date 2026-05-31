import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { createStyleContext } from '@/styled-system/jsx';
import { tooltip } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(tooltip);

export function Provider({ delay = 300, ...props }: BaseTooltip.Provider.Props) {
  return <BaseTooltip.Provider delay={delay} {...props} />;
}

export const Root = withProvider(BaseTooltip.Root, 'root');
export const Trigger = withContext(BaseTooltip.Trigger, 'trigger');

const StyledPositioner = withContext(BaseTooltip.Positioner, 'positioner');
const StyledPopup = withContext(BaseTooltip.Popup, 'popup');
const StyledArrow = withContext(BaseTooltip.Arrow, 'arrow');

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
