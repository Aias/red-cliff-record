import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { createSlotRecipeContext } from '@/styled-system/jsx';
import { avatar } from '@/styled-system/recipes';

const { withProvider, withContext } = createSlotRecipeContext(avatar);

export const Root = withProvider(BaseAvatar.Root, 'root');

export const Image = withContext(BaseAvatar.Image, 'image');

export const Fallback = withContext(BaseAvatar.Fallback, 'fallback');
