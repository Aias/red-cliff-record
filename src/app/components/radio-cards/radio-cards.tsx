import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { createStyleContext } from '@/styled-system/jsx';
import { radioCards } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(radioCards);

export const RadioCards = withProvider(RadioGroup, 'root');
export type RadioCardsProps = ComponentProps<typeof RadioCards>;

export const RadioCardsItem = withContext(Radio.Root, 'item');
export type RadioCardsItemProps = ComponentProps<typeof RadioCardsItem>;
