import { Popover as BasePopover } from '@base-ui/react/popover';
import { createStyleContext } from '@/styled-system/jsx';
import { popover } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(popover);

export const Root = withProvider(BasePopover.Root, 'root');
export const Trigger = withContext(BasePopover.Trigger, 'trigger');

const StyledPositioner = withContext(BasePopover.Positioner, 'positioner');
const StyledPopup = withContext(BasePopover.Popup, 'popup');

type PositionerProps = Pick<
  BasePopover.Positioner.Props,
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
  | 'collisionAvoidance'
>;

export function Content({
  anchor,
  positionMethod,
  side,
  sideOffset = 4,
  align = 'center',
  alignOffset,
  collisionBoundary,
  collisionPadding = 16,
  sticky,
  arrowPadding,
  collisionAvoidance,
  children,
  ...props
}: ComponentProps<typeof StyledPopup> & PositionerProps) {
  return (
    <BasePopover.Portal>
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
        collisionAvoidance={collisionAvoidance}
      >
        <StyledPopup {...props}>{children}</StyledPopup>
      </StyledPositioner>
    </BasePopover.Portal>
  );
}
