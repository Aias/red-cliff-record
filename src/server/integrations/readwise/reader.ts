import { z } from 'zod';
import { ReadwiseArticlesResponseSchema } from './types';

const REQUEST_TIMEOUT_MS = 30_000;

const ToolResponseSchema = z.object({
  result: z.object({
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
    isError: z.boolean().optional(),
    structuredContent: z.unknown().optional(),
  }),
});

const HighlightsSchema = z.object({
  result: z.array(z.object({ id: z.string(), content: z.string() })),
});

const parseJson = (value: string): unknown => JSON.parse(value);

const readwiseToken = () => {
  const token = process.env.READWISE_TOKEN;
  if (!token) throw new Error('READWISE_TOKEN is required to fetch Reader content');
  return token;
};

const withTimeout = (signal?: AbortSignal) => {
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
};

export async function fetchReaderHighlights(documentId: string, signal?: AbortSignal) {
  const response = await fetch('https://mcp2.readwise.io/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Token ${readwiseToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'reader_get_document_highlights', arguments: { document_id: documentId } },
    }),
    signal: withTimeout(signal),
  });
  if (!response.ok) throw new Error(`Reader highlights ${documentId}: HTTP ${response.status}`);
  const body = await response.text();
  const message =
    body
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.slice(5) ?? body;
  const { result } = ToolResponseSchema.parse(parseJson(message));
  const text = result.content.find((item) => item.type === 'text')?.text;
  if (result.isError) throw new Error(text || `Reader highlights ${documentId}: tool error`);
  const payload = result.structuredContent ?? { result: text === undefined ? [] : parseJson(text) };
  return HighlightsSchema.parse(payload).result;
}

export async function fetchDocumentHtml(documentId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ id: documentId, withHtmlContent: 'true' });
  const request = () =>
    fetch(`https://readwise.io/api/v3/list/?${query}`, {
      headers: { Authorization: `Token ${readwiseToken()}` },
      signal: withTimeout(signal),
    });
  let response = await request();
  if (response.status === 429) {
    await Bun.sleep((Number(response.headers.get('Retry-After')) || 60) * 1000);
    signal?.throwIfAborted();
    response = await request();
  }
  if (!response.ok) throw new Error(`Reader document ${documentId}: HTTP ${response.status}`);
  const page = ReadwiseArticlesResponseSchema.parse(await response.json());
  return page.results[0]?.html_content || null;
}
