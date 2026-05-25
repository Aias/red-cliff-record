import type MarkdownIt from 'markdown-it';
import MarkdownItLib from 'markdown-it';
import { useMemo } from 'react';
import { Prose, type ProseProps } from './prose';

/** Plugin to parse ==highlighted text== as <mark> elements */
function markPlugin(md: MarkdownIt) {
  const MARKER = '==';

  md.inline.ruler.before('emphasis', 'mark', (state, silent) => {
    const start = state.pos;
    const src = state.src;

    if (src.slice(start, start + 2) !== MARKER) return false;

    const end = src.indexOf(MARKER, start + 2);
    if (end === -1) return false;

    if (!silent) {
      const token = state.push('mark', 'mark', 0);
      token.content = src.slice(start + 2, end);
    }

    state.pos = end + 2;
    return true;
  });

  md.renderer.rules.mark = (tokens, idx) => {
    const token = tokens[idx];
    return `<mark>${md.utils.escapeHtml(token?.content ?? '')}</mark>`;
  };
}

const md = new MarkdownItLib({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
}).use(markPlugin);

export type MarkdownProps = Omit<ProseProps, 'children' | 'as' | 'dangerouslySetInnerHTML'> & {
  children: string;
};

/**
 * Renders markdown content as HTML through {@link Prose}.
 *
 * Panda props (`css`, recipe variants) and Base UI's `render` prop both flow to `Prose`,
 * which is `styled(PolymorphicDiv, prose)` — so the rendered root tag is swappable
 * while keeping prose styles and the `css` pipeline intact.
 */
export function Markdown({ children, ...props }: MarkdownProps) {
  const html = useMemo(() => md.render(children), [children]);

  return <Prose {...props} data-slot="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
