import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { createStyleContext } from '@/styled-system/jsx';
import { alertDialog } from '@/styled-system/recipes';

const { withProvider, withContext } = createStyleContext(alertDialog);

export const Root = withProvider(AlertDialogPrimitive.Root, 'root');
export const Trigger = withContext(AlertDialogPrimitive.Trigger, 'trigger');
export const Portal = withContext(AlertDialogPrimitive.Portal, 'portal');
export const Overlay = withContext(AlertDialogPrimitive.Overlay, 'overlay');
export const Content = withContext(AlertDialogPrimitive.Content, 'content');
export const Title = withContext(AlertDialogPrimitive.Title, 'title');
export const Description = withContext(AlertDialogPrimitive.Description, 'description');
export const Action = withContext(AlertDialogPrimitive.Action, 'action');
export const Cancel = withContext(AlertDialogPrimitive.Cancel, 'cancel');
export const Header = withContext('div', 'header');
export const Footer = withContext('div', 'footer');
