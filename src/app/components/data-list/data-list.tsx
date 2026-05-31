import { createStyleContext } from '@/styled-system/jsx';
import { dataList } from '@/styled-system/recipes';
import type { ComponentProps } from '@/styled-system/types';

const { withProvider, withContext } = createStyleContext(dataList);

export const Root = withProvider('dl', 'root');
export type RootProps = ComponentProps<typeof Root>;
export const Item = withContext('div', 'item');
export const Label = withContext('dt', 'label');
export const Value = withContext('dd', 'value');
