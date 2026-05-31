import { Menu as BaseMenu } from '@base-ui/react/menu';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { createStyleContext, styled } from '@/styled-system/jsx';
import { dropdownMenu } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(dropdownMenu);

export const Root = withProvider(BaseMenu.Root, 'root');
export const Trigger = withContext(BaseMenu.Trigger, 'trigger');
export const Group = withContext(BaseMenu.Group, 'group');
export const RadioGroup = withContext(BaseMenu.RadioGroup, 'radioGroup');
export const Separator = withContext(BaseMenu.Separator, 'separator');
export const Shortcut = withContext('span', 'shortcut');
export const Sub = BaseMenu.SubmenuRoot;

const StyledPositioner = withContext(BaseMenu.Positioner, 'positioner');
const StyledPopup = withContext(BaseMenu.Popup, 'popup');
const StyledLabel = withContext(BaseMenu.GroupLabel, 'label');
const StyledItem = withContext(BaseMenu.Item, 'item');
const StyledCheckboxItem = withContext(BaseMenu.CheckboxItem, 'checkboxItem');
const StyledRadioItem = withContext(BaseMenu.RadioItem, 'radioItem');
const StyledItemIndicator = withContext('span', 'itemIndicator');
const StyledSubTrigger = withContext(BaseMenu.SubmenuTrigger, 'subTrigger');

type PositionerProps = Pick<
  BaseMenu.Positioner.Props,
  'align' | 'alignOffset' | 'side' | 'sideOffset'
>;

export function Content({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  children,
  ...props
}: ComponentProps<typeof StyledPopup> & PositionerProps) {
  return (
    <BaseMenu.Portal>
      <StyledPositioner align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset}>
        <StyledPopup {...props}>{children}</StyledPopup>
      </StyledPositioner>
    </BaseMenu.Portal>
  );
}

export function SubContent({
  align = 'start',
  alignOffset = -3,
  side = 'right',
  sideOffset = 0,
  children,
  ...props
}: ComponentProps<typeof StyledPopup> & PositionerProps) {
  return (
    <BaseMenu.Portal>
      <StyledPositioner align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset}>
        <StyledPopup {...props}>{children}</StyledPopup>
      </StyledPositioner>
    </BaseMenu.Portal>
  );
}

export function Label({
  inset,
  ...props
}: ComponentProps<typeof StyledLabel> & { inset?: boolean }) {
  return <StyledLabel data-inset={inset || undefined} {...props} />;
}

export function Item({
  inset,
  variant = 'default',
  ...props
}: ComponentProps<typeof StyledItem> & { inset?: boolean; variant?: 'default' | 'destructive' }) {
  return <StyledItem data-inset={inset || undefined} data-variant={variant} {...props} />;
}

export function CheckboxItem({
  children,
  inset,
  ...props
}: ComponentProps<typeof StyledCheckboxItem> & { inset?: boolean }) {
  return (
    <StyledCheckboxItem data-inset={inset || undefined} {...props}>
      <StyledItemIndicator>
        <BaseMenu.CheckboxItemIndicator>
          <CheckIcon />
        </BaseMenu.CheckboxItemIndicator>
      </StyledItemIndicator>
      {children}
    </StyledCheckboxItem>
  );
}

export function RadioItem({
  children,
  inset,
  ...props
}: ComponentProps<typeof StyledRadioItem> & { inset?: boolean }) {
  return (
    <StyledRadioItem data-inset={inset || undefined} {...props}>
      <StyledItemIndicator>
        <BaseMenu.RadioItemIndicator>
          <CheckIcon />
        </BaseMenu.RadioItemIndicator>
      </StyledItemIndicator>
      {children}
    </StyledRadioItem>
  );
}

export function SubTrigger({
  children,
  inset,
  ...props
}: ComponentProps<typeof StyledSubTrigger> & { inset?: boolean }) {
  return (
    <StyledSubTrigger data-inset={inset || undefined} {...props}>
      {children}
      <styled.span
        css={{ marginInlineStart: 'auto', display: 'inline-flex', _childIcon: { boxSize: '4' } }}
      >
        <ChevronRightIcon />
      </styled.span>
    </StyledSubTrigger>
  );
}
