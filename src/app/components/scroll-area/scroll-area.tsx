import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { createStyleContext } from '@/styled-system/jsx';
import { scrollArea } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(scrollArea);

const Root = withProvider(ScrollAreaPrimitive.Root, 'root');
export type RootProps = ComponentProps<typeof Root>;
const Viewport = withContext(ScrollAreaPrimitive.Viewport, 'viewport');
const ScrollBar = withContext(ScrollAreaPrimitive.ScrollAreaScrollbar, 'scrollbar');
const Corner = withContext(ScrollAreaPrimitive.ScrollAreaCorner, 'corner');
const Thumb = withContext(ScrollAreaPrimitive.ScrollAreaThumb, 'thumb');

export const ScrollArea = ({ children, orientation = 'vertical', ...props }: RootProps) => {
  const resolvedOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  return (
    <Root orientation={resolvedOrientation} {...props}>
      <Viewport>{children}</Viewport>
      <ScrollBar orientation={resolvedOrientation}>
        <Thumb />
      </ScrollBar>
      <Corner />
    </Root>
  );
};
