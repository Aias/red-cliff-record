import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import { cn } from '@/lib/utils';

const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
});

interface MarkdownProps {
	children: string;
	className?: string;
	/** Render inline (no block elements like <p>) */
	inline?: boolean;
}

/**
 * Renders markdown content as HTML.
 * Uses markdown-it with linkify (auto-links URLs) and typographer (smart quotes/dashes).
 */
export function Markdown({ children, className, inline = false }: MarkdownProps) {
	const html = useMemo(() => {
		if (inline) {
			return md.renderInline(children);
		}
		return md.render(children);
	}, [children, inline]);

	return <div className={cn('prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
