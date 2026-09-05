import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 30_000;
const TextContentSchema = z.object({ type: z.literal('text'), text: z.string() });
const ToolResultSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  isError: z.boolean().optional(),
  structuredContent: z.unknown().optional(),
});
const HighlightsSchema = z.object({
  result: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      tags: z.array(z.string()),
      notes: z.string().nullable(),
    })
  ),
});
const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
});

async function fetchReaderResult<T>(
  name: 'reader_get_document_highlights' | 'reader_get_document_details',
  documentId: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  const token = process.env.READWISE_TOKEN;
  if (!token) throw new Error('READWISE_TOKEN is required to fetch Reader content');
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const options = { signal: requestSignal, timeout: REQUEST_TIMEOUT_MS };
  const client = new Client({ name: 'red-cliff-record', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://mcp2.readwise.io/mcp'), {
    requestInit: { headers: { Authorization: `Token ${token}` } },
    fetch: async (url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
        return new Response(null, { status: 405 });
      }
      return fetch(url, {
        ...init,
        signal: init?.signal ? AbortSignal.any([requestSignal, init.signal]) : requestSignal,
      });
    },
  });
  try {
    await client.connect(transport, options);
    const result = ToolResultSchema.parse(
      await client.callTool({ name, arguments: { document_id: documentId } }, undefined, options)
    );
    if (result.isError) {
      const message = result.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n');
      throw new Error(message || 'The Reader tool returned an error without details');
    }
    let data: unknown = result.structuredContent;
    if (data === undefined) {
      const text = TextContentSchema.safeParse(result.content.find((item) => item.type === 'text'));
      if (!text.success) throw new Error('The Reader tool returned no JSON response content');
      try {
        data = JSON.parse(text.data.text);
      } catch {
        throw new Error('The Reader tool returned invalid JSON');
      }
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`The Reader response has an invalid shape: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  } catch (error) {
    signal?.throwIfAborted();
    const message = deadline.aborted
      ? 'The request timed out'
      : error instanceof Error
        ? error.message
        : 'The request failed';
    throw new Error(`Readwise ${name} failed: ${message.replaceAll(token, '[redacted]')}`);
  } finally {
    await client.close();
  }
}

export async function fetchReaderHighlights(documentId: string, signal?: AbortSignal) {
  return (
    await fetchReaderResult('reader_get_document_highlights', documentId, HighlightsSchema, signal)
  ).result;
}

export function fetchReaderDocument(documentId: string, signal?: AbortSignal) {
  return fetchReaderResult('reader_get_document_details', documentId, DocumentSchema, signal);
}
