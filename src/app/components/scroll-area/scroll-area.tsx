import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import { createStyleContext } from '@/styled-system/jsx';
import { scrollArea } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(scrollArea);

const Root = withProvider(BaseScrollArea.Root, 'root');
export type RootProps = ComponentProps<typeof Root>;
const Viewport = withContext(BaseScrollArea.Viewport, 'viewport');
const Content = withContext(BaseScrollArea.Content, 'content');
const ScrollBar = withContext(BaseScrollArea.Scrollbar, 'scrollbar');
const Corner = withContext(BaseScrollArea.Corner, 'corner');
const Thumb = withContext(BaseScrollArea.Thumb, 'thumb');

export const ScrollArea = ({ children, orientation = 'vertical', ...props }: RootProps) => {
  const resolvedOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
  return (
    <Root orientation={resolvedOrientation} {...props}>
      <Viewport>
        <Content>{children}</Content>
      </Viewport>
      <ScrollBar orientation={resolvedOrientation}>
        <Thumb />
      </ScrollBar>
      <Corner />
    </Root>
  );
};
