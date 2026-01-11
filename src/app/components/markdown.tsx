import { useMemo } from 'react';
import { Marked } from 'marked';
import markedLinkifyIt from 'marked-linkify-it';
import { markedSmartypants } from 'marked-smartypants';
import { cn } from '@/lib/utils';

const marked = new Marked();
marked.use(markedLinkifyIt(), markedSmartypants());

interface MarkdownProps {
	children: string;
	className?: string;
	/** Render inline (no block elements like <p>) */
	inline?: boolean;
}

/**
 * Renders markdown content as HTML.
 * Uses marked with linkify-it (auto-links URLs) and smartypants (smart quotes/dashes).
 */
export function Markdown({ children, className, inline = false }: MarkdownProps) {
	const html = useMemo(() => {
		if (inline) {
			return marked.parseInline(children);
		}
		return marked.parse(children);
	}, [children, inline]);

	return <div className={cn('prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
