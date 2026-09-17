import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card';
import { createStyleContext } from '@/styled-system/jsx';
import { hoverCard } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(hoverCard);

export const createHandle = BasePreviewCard.createHandle;
export const Root = BasePreviewCard.Root;
export const Trigger = BasePreviewCard.Trigger;

const StyledPositioner = withProvider(BasePreviewCard.Positioner, 'positioner');
const StyledPopup = withContext(BasePreviewCard.Popup, 'popup');

type PositionerProps = Pick<
  BasePreviewCard.Positioner.Props,
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
  collisionPadding,
  sticky,
  arrowPadding,
  collisionAvoidance,
  children,
  ...props
}: ComponentProps<typeof StyledPopup> & PositionerProps) {
  return (
    <BasePreviewCard.Portal>
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
    </BasePreviewCard.Portal>
  );
}
