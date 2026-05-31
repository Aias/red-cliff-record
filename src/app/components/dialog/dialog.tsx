import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import { createStyleContext, styled } from '@/styled-system/jsx';
import { dialog } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(dialog);

export const Root = withProvider(BaseDialog.Root, 'root');
export const Trigger = withContext(BaseDialog.Trigger, 'trigger');
export const Close = withContext(BaseDialog.Close, 'close');
export const Title = withContext(BaseDialog.Title, 'title');
export const Description = withContext(BaseDialog.Description, 'description');
export const Header = withContext('div', 'header');
export const Footer = withContext('div', 'footer');

const StyledBackdrop = withContext(BaseDialog.Backdrop, 'backdrop');
const StyledPopup = withContext(BaseDialog.Popup, 'popup');

export function Content({
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof StyledPopup> & { showCloseButton?: boolean }) {
  return (
    <BaseDialog.Portal>
      <StyledBackdrop />
      <StyledPopup {...props}>
        {children}
        {showCloseButton && (
          <Close>
            <XIcon />
            <styled.span css={{ srOnly: true }}>Close</styled.span>
          </Close>
        )}
      </StyledPopup>
    </BaseDialog.Portal>
  );
}
