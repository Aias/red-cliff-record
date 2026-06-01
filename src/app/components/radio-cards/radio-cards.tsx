import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { createStyleContext, type HTMLStyledProps } from '@/styled-system/jsx';
import { radioCards, type RadioCardsVariantProps } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(radioCards);

const RadioCardsRoot = withProvider(RadioGroup, 'root');
type RadioCardsRootProps = ComponentProps<typeof RadioCardsRoot>;

// `withProvider` widens RadioGroup's `<Value>` generic to `any`, dropping type safety on
// `value`/`onValueChange`. A real generic wrapper restores it. Compose the props from the clean
// `RadioGroup.Props<Value>` plus only the Panda `css`/`unstyled` keys — the full styled props
// carry an `[k: string]: unknown` index signature that would poison inference (`Value` collapses
// to `unknown`). `Value` then infers from `value` and defaults to `string`, so no call site needs
// an explicit type argument, yet a group can still narrow to a literal union (e.g. `'yes' | 'no'`).
export type RadioCardsProps<Value extends string = string> = RadioGroup.Props<Value> &
  RadioCardsVariantProps &
  Pick<HTMLStyledProps<'div'>, 'css' | 'unstyled'>;

export function RadioCards<Value extends string = string>(
  props: RadioCardsProps<Value>
): ReactNode {
  return <RadioCardsRoot {...(props as RadioCardsRootProps)} />;
}

export const RadioCardsItem = withContext(Radio.Root, 'item');
export type RadioCardsItemProps = ComponentProps<typeof RadioCardsItem>;
