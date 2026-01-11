/**
 * Fetch commands for the CLI
 *
 * Fetches web content and converts it to clean markdown using Jina Reader.
 */

import { z } from 'zod';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const JINA_READER_BASE = 'https://r.jina.ai/';

const FetchOptionsSchema = BaseOptionsSchema.extend({
	/** Return only the markdown content without metadata */
	'content-only': z.boolean().optional(),
}).strict();

interface JinaReaderResult {
	[key: string]: string | null;
	title: string | null;
	url: string;
	markdown: string;
}

/**
 * Parse Jina Reader response into structured data.
 * Jina returns plain text with Title:, URL Source:, and Markdown Content: sections.
 */
function parseJinaResponse(response: string): JinaReaderResult {
	const lines = response.split('\n');

	let title: string | null = null;
	let url = '';
	let markdownStartIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line?.startsWith('Title: ')) {
			title = line.slice(7).trim() || null;
		} else if (line?.startsWith('URL Source: ')) {
			url = line.slice(12).trim();
		} else if (line === 'Markdown Content:') {
			markdownStartIndex = i + 1;
			break;
		}
	}

	const markdown = lines.slice(markdownStartIndex).join('\n').trim();

	return { title, url, markdown };
}

/**
 * Fetch a URL and return clean markdown
 * Usage: rcr fetch <url> [--content-only]
 *
 * Uses Jina Reader (r.jina.ai) to extract article content as markdown.
 * Preserves headings, bold, italic, links, lists, and blockquotes.
 *
 * Examples:
 *   rcr fetch https://example.com/article
 *   rcr fetch https://example.com/article --content-only --raw
 */
export const url: CommandHandler = async (args, options) => {
	const opts = parseOptions(FetchOptionsSchema, options);

	const targetUrl = args[0];
	if (!targetUrl) {
		throw createError('VALIDATION_ERROR', 'URL is required');
	}

	// Basic URL validation
	try {
		new URL(targetUrl);
	} catch {
		throw createError('VALIDATION_ERROR', `Invalid URL: ${targetUrl}`);
	}

	const jinaUrl = `${JINA_READER_BASE}${targetUrl}`;

	const response = await fetch(jinaUrl, {
		headers: {
			Accept: 'text/plain',
		},
	});

	if (!response.ok) {
		throw createError(
			'INTERNAL_ERROR',
			`Failed to fetch URL: ${response.status} ${response.statusText}`
		);
	}

	const text = await response.text();
	const parsed = parseJinaResponse(text);

	if (opts['content-only']) {
		return success(parsed.markdown);
	}

	return success(parsed);
};
