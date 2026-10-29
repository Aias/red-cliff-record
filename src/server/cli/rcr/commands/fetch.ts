import { Argument, Command, Flag } from 'effect/cli';
import { createError } from '../lib/errors';
import { respond, success } from '../lib/output';

const JINA_READER_BASE = 'https://r.jina.ai/';

/**
 * Parse Jina Reader response into structured data.
 * Jina returns plain text with Title:, URL Source:, and Markdown Content: sections.
 */
function parseJinaResponse(response: string) {
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

const url = Command.make(
  'url',
  {
    url: Argument.String('url').pipe(Argument.withDescription('Page URL to fetch')),
    contentOnly: Flag.Boolean('content-only').pipe(
      Flag.withDescription('Return only the markdown, without title and URL'),
      Flag.withDefault(false)
    ),
  },
  ({ url: targetUrl, contentOnly }) =>
    respond(async (signal) => {
      if (!URL.canParse(targetUrl)) {
        throw createError('VALIDATION_ERROR', `Invalid URL: ${targetUrl}`);
      }
      const response = await fetch(`${JINA_READER_BASE}${targetUrl}`, {
        headers: { Accept: 'text/plain' },
        signal,
      });
      if (!response.ok) {
        throw createError(
          'INTERNAL_ERROR',
          `Failed to fetch URL: ${response.status} ${response.statusText}`
        );
      }
      const parsed = parseJinaResponse(await response.text());
      return success(contentOnly ? parsed.markdown : parsed);
    })
).pipe(
  Command.withDescription('Fetch a URL as clean markdown with Jina Reader'),
  Command.withExamples([
    { command: 'rcr fetch url https://example.com/article' },
    { command: 'rcr fetch url https://example.com/article --content-only --raw' },
  ])
);

const fetchGroup = Command.make('fetch').pipe(
  Command.withDescription('Fetch web content'),
  Command.withSubcommands([url])
);

export { fetchGroup as fetch };
