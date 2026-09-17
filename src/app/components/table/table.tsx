import { createStyleContext } from '@/styled-system/jsx';
import { table } from '@/styled-system/recipes';

const { withProvider, withContext } = createStyleContext(table);

export const Root = withProvider('div', 'root');
export const Table = withContext('table', 'table');
export const Header = withContext('thead', 'header');
export const Body = withContext('tbody', 'body');
export const Footer = withContext('tfoot', 'footer');
export const Row = withContext('tr', 'row');
export const Head = withContext('th', 'head');
export const Cell = withContext('td', 'cell');
export const Caption = withContext('caption', 'caption');
