import { Marked } from 'marked';
import markedLinkifyIt from 'marked-linkify-it';
import { markedSmartypants } from 'marked-smartypants';

const marked = new Marked({
	breaks: true,
	gfm: true,
	async: false,
});

marked.use(markedSmartypants(), markedLinkifyIt());

export function parseToSingleLine(text: string) {
	return (marked.parseInline(text) as string)
		.replace(/<br\s*\/?>/g, ' ') // Replace <br> tags with spaces
		.replace(/[\t\n]/g, ' ') // Replace tabs and newlines with spaces
		.replace(/\s+/g, ' ') // Collapse multiple spaces into single space
		.trim();
}

export { marked };
