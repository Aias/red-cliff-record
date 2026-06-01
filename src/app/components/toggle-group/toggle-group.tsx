import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';
import { createContext, useContext } from 'react';
import { css } from '@/styled-system/css';
import { styled, type HTMLStyledProps } from '@/styled-system/jsx';
import { toggle } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

type ToggleVariant = 'default' | 'outline';

const ToggleGroupVariantContext = createContext<ToggleVariant>('default');

const groupCss = css.raw({
  display: 'flex',
  width: '[fit-content]',
  alignItems: 'center',
  borderRadius: 'md',
  '&[data-variant=outline]': {
    boxShadow: 'xs',
  },
});

const StyledGroup = styled(BaseToggleGroup);
type StyledGroupProps = ComponentProps<typeof StyledGroup>;

// `styled()` widens BaseToggleGroup's `<Value extends string>` to `string`, so `value`/
// `onValueChange` lose their narrow element type. Keep Root generic at the public
// boundary and cast back to the widened styled props for the internal spread.
export type RootProps<Value extends string = string> = BaseToggleGroup.Props<Value> &
  HTMLStyledProps<'div'> & { variant?: ToggleVariant };

export function Root<Value extends string = string>({
  variant = 'default',
  css: cssProp,
  ...props
}: RootProps<Value>) {
  return (
    <ToggleGroupVariantContext.Provider value={variant}>
      <StyledGroup
        data-variant={variant}
        css={css.raw(groupCss, cssProp)}
        {...(props as StyledGroupProps)}
      />
    </ToggleGroupVariantContext.Provider>
  );
}

const StyledItem = styled(BaseToggle, toggle);

// A toggle inside a group keeps the base toggle look but flattens into a segmented bar:
// the group owns the outer radius/shadow, so items square off and collapse shared borders,
// re-rounding only the leading and trailing edges.
const segmentedItemCss = css.raw({
  flex: '1',
  minWidth: '0',
  borderRadius: 'none',
  boxShadow: 'none',
  _first: {
    borderStartStartRadius: 'md',
    borderEndStartRadius: 'md',
  },
  _last: {
    borderStartEndRadius: 'md',
    borderEndEndRadius: 'md',
  },
  _focusVisible: {
    zIndex: '10',
  },
  '&[data-variant=outline]': {
    borderInlineStartWidth: '0',
    _first: {
      borderInlineStartWidth: '1px',
    },
  },
});

export type ItemProps = ComponentProps<typeof StyledItem>;

export function Item({ css: cssProp, ...props }: ItemProps) {
  const variant = useContext(ToggleGroupVariantContext);
  return (
    <StyledItem
      variant={variant}
      data-variant={variant}
      css={css.raw(segmentedItemCss, cssProp)}
      {...props}
    />
  );
}
