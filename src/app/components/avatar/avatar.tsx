import { Avatar as AvatarPrimitive } from 'radix-ui';
import { createStyleContext } from '@/styled-system/jsx';
import { avatar } from '@/styled-system/recipes';

const { withProvider, withContext } = createStyleContext(avatar);

export const Root = withProvider(AvatarPrimitive.Root, 'root', {
  defaultProps: { tabIndex: -1 },
});
Root.displayName = AvatarPrimitive.Root.displayName;

export const Image = withContext(AvatarPrimitive.Image, 'image');
Image.displayName = AvatarPrimitive.Image.displayName;

export const Fallback = withContext(AvatarPrimitive.Fallback, 'fallback');
Fallback.displayName = AvatarPrimitive.Fallback.displayName;
