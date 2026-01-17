import type MarkdownIt from 'markdown-it';
import MarkdownItLib from 'markdown-it';
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

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
  html: false,
  linkify: true,
  typographer: true,
}).use(markPlugin);

interface MarkdownProps {
  children: string;
  className?: string;
  as?: React.ElementType;
}

/**
 * Renders markdown content as HTML.
 */
export function Markdown({ children, className, as = 'div' }: MarkdownProps) {
  const html = useMemo(() => {
    return md.render(children);
  }, [children]);

  return React.createElement(as, {
    className: cn('prose', className),
    dangerouslySetInnerHTML: { __html: html },
  });
}
