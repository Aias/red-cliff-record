import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { createStyleContext } from '@/styled-system/jsx';
import { dialog } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

// An alert dialog is a dialog with the `alertdialog` role and no light-dismiss — it
// shares the dialog's visuals, so it reuses the dialog recipe rather than duplicating it.
const { withProvider, withContext } = createStyleContext(dialog);

export const Root = withProvider(BaseAlertDialog.Root, 'root');
export const Trigger = withContext(BaseAlertDialog.Trigger, 'trigger');
export const Close = BaseAlertDialog.Close;
export const Title = withContext(BaseAlertDialog.Title, 'title');
export const Description = withContext(BaseAlertDialog.Description, 'description');
export const Header = withContext('div', 'header');
export const Footer = withContext('div', 'footer');

const StyledBackdrop = withContext(BaseAlertDialog.Backdrop, 'backdrop');
const StyledPopup = withContext(BaseAlertDialog.Popup, 'popup');

export function Content({ children, ...props }: ComponentProps<typeof StyledPopup>) {
  return (
    <BaseAlertDialog.Portal>
      <StyledBackdrop />
      <StyledPopup {...props}>{children}</StyledPopup>
    </BaseAlertDialog.Portal>
  );
}
