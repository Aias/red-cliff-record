import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { z } from 'zod';
import { fetchReaderDocument, fetchReaderHighlights } from './reader';

const originalToken = process.env.READWISE_TOKEN;
const RequestSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

beforeEach(() => {
  process.env.READWISE_TOKEN = 'reader-test-token';
});

afterEach(() => {
  mock.restore();
  if (originalToken === undefined) delete process.env.READWISE_TOKEN;
  else process.env.READWISE_TOKEN = originalToken;
});

function fakeTransport(toolResult: unknown, onCall?: () => void) {
  const requests: Array<z.infer<typeof RequestSchema>> = [];
  const signals: AbortSignal[] = [];
  spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    expect(request.url).toBe('https://mcp2.readwise.io/mcp');
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Token reader-test-token');
    signals.push(request.signal);
    const message = RequestSchema.parse(await request.json());
    requests.push(message);
    if (message.method.startsWith('notifications/')) {
      return new Response(null, { status: 202 });
    }
    if (message.method === 'initialize') {
      return Response.json({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'reader-test', version: '1.0.0' },
        },
      });
    }
    onCall?.();
    request.signal.throwIfAborted();
    return Response.json({ jsonrpc: '2.0', id: message.id, result: toolResult });
  });
  return { requests, signals };
}

describe('Reader content transport', () => {
  test('preserves highlight Markdown and closes the connection', async () => {
    const highlight = {
      id: 'highlight-a',
      content: 'A **careful reader**.\n\n[The source](https://example.com/article).',
      tags: ['writing'],
      notes: null,
    };
    const transport = fakeTransport({ content: [], structuredContent: { result: [highlight] } });
    expect(await fetchReaderHighlights('document-a')).toEqual([highlight]);
    expect(transport.requests.find((request) => request.method === 'tools/call')?.params).toEqual({
      name: 'reader_get_document_highlights',
      arguments: { document_id: 'document-a' },
    });
    expect(transport.signals.every((signal) => signal.aborted)).toBe(true);
  });

  test('reads the JSON text envelope when structured content is absent', async () => {
    const document = { id: 'document-a', title: 'Reading', content: '# Reading\n\nA paragraph.' };
    fakeTransport({ content: [{ type: 'text', text: JSON.stringify(document) }] });
    expect(await fetchReaderDocument('document-a')).toEqual(document);
  });

  test('rejects an empty response', async () => {
    fakeTransport({ content: [] });
    await expect(fetchReaderHighlights('document-a')).rejects.toThrow('no JSON response content');
  });

  test('rejects non-JSON text', async () => {
    fakeTransport({ content: [{ type: 'text', text: 'not JSON' }] });
    await expect(fetchReaderHighlights('document-a')).rejects.toThrow('invalid JSON');
  });

  test('rejects malformed highlights without accepting the text fallback', async () => {
    fakeTransport({
      content: [{ type: 'text', text: '{"result":[]}' }],
      structuredContent: { result: [{ id: 'highlight-a', content: 42, tags: [], notes: null }] },
    });
    await expect(fetchReaderHighlights('document-a')).rejects.toThrow('invalid shape');
  });

  test('redacts credentials from tool errors and closes the connection', async () => {
    const transport = fakeTransport({
      content: [{ type: 'text', text: 'Rejected reader-test-token' }],
      isError: true,
    });
    await expect(fetchReaderHighlights('document-a')).rejects.toThrow('Rejected [redacted]');
    expect(transport.signals.every((signal) => signal.aborted)).toBe(true);
  });

  test('propagates caller cancellation and aborts the HTTP request', async () => {
    const controller = new AbortController();
    const reason = new Error('Reader lookup cancelled');
    const transport = fakeTransport({ content: [] }, () => controller.abort(reason));
    await expect(fetchReaderHighlights('document-a', controller.signal)).rejects.toBe(reason);
    expect(transport.signals.every((signal) => signal.aborted)).toBe(true);
  });
});
