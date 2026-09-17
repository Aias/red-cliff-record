import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import { createStyleContext } from '@/styled-system/jsx';
import { command } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(command);

export const Root = withProvider(CommandPrimitive, 'root');
export type RootProps = ComponentProps<typeof Root>;

const StyledInputWrapper = withContext('div', 'inputWrapper');
const StyledInput = withContext(CommandPrimitive.Input, 'input');
type InputProps = ComponentProps<typeof StyledInput> & {
  wrapperProps?: ComponentProps<typeof StyledInputWrapper>;
};
export const Input = ({ wrapperProps, ...props }: InputProps) => {
  return (
    <StyledInputWrapper {...wrapperProps}>
      <SearchIcon />
      <StyledInput {...props} />
    </StyledInputWrapper>
  );
};

export const List = withContext(CommandPrimitive.List, 'list');
export const Item = withContext(CommandPrimitive.Item, 'item');
export const Group = withContext(CommandPrimitive.Group, 'group');
export const Separator = withContext(CommandPrimitive.Separator, 'separator');
export const Loading = withContext(CommandPrimitive.Loading, 'loading');
export const Empty = withContext(CommandPrimitive.Empty, 'empty');
export const Shortcut = withContext('span', 'shortcut');
