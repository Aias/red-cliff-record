import { gfm } from '@joplin/turndown-plugin-gfm';
import domino from '@mixmark-io/domino';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
import type { Range } from './locate';

const markdown = new MarkdownIt({ html: true });
export const renderMarkdown = (content: string) => markdown.render(content);
export const markdownTokens = (content: string) => markdown.parse(content, {});
export const htmlText = (html: string) => domino.createDocument(html).body.textContent ?? '';

const BULLET = '-';
const turndown = new TurndownService({
  bulletListMarker: BULLET,
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  headingStyle: 'atx',
  hr: '---',
})
  .use(gfm)
  .keep(['sub', 'sup'])
  .addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const parent = node.parentElement;
      const index = parent ? Array.from(parent.children).findIndex((child) => child === node) : 0;
      const start = Number(parent?.getAttribute('start')) || 1;
      const prefix = parent?.nodeName === 'OL' ? `${start + index}. ` : `${BULLET} `;
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replaceAll('\n', `\n${' '.repeat(prefix.length)}`);
      return prefix + body + (node.nextSibling && !body.endsWith('\n') ? '\n' : '');
    },
  });

const EXCLUDED = 'button, form, head, input, noscript, script, select, style, template, textarea';
const MEDIA = 'audio, embed, iframe, img, object, svg, video';
const EMBEDDED = new Set(['AUDIO', 'EMBED', 'IFRAME', 'OBJECT', 'SVG', 'VIDEO']);
const KEEP_EMPTY = new Set(['BR', 'HR']);
const BLOCKS = new Set([
  'ARTICLE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'MAIN',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
  'UL',
]);
const FOOTNOTE_HREF =
  /^#(?:user-content-)?(?:fn(?:ref)?|(?:cite[_-])?note|endnote|footnote)[:_\d-]/i;
const FOOTNOTE_LABEL = /^\s*\[?\s*(?:\d+|[*†‡]+)\s*\]?\s*$/u;

export type SourceImage = { url: string; altText: string | null; position: number };
type Slot = { node: ChildNode; start: number; end: number };

const httpUrl = (value: string | null, baseUrl: string | null) => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, baseUrl ?? undefined);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const isFootnoteReference = (anchor: Element) =>
  anchor.getAttribute('role') === 'doc-noteref' ||
  anchor.hasAttribute('data-footnote-ref') ||
  (FOOTNOTE_HREF.test(anchor.getAttribute('href') ?? '') &&
    FOOTNOTE_LABEL.test(anchor.textContent ?? ''));

function indexDocument(document: Document, baseUrl: string | null) {
  let text = '';
  const slots: Slot[] = [];
  const images: SourceImage[] = [];
  const barriers: number[] = [];
  const embedded: number[] = [];
  const unresolved: number[] = [];
  const lineBreak = () => {
    if (text && !text.endsWith('\n')) text += '\n';
  };
  const visit = (node: ChildNode) => {
    if (node instanceof domino.impl.Text) {
      const start = text.length;
      text += node.data;
      slots.push({ node, start, end: text.length });
      return;
    }
    if (!(node instanceof domino.impl.Element)) return;
    if (EMBEDDED.has(node.nodeName)) {
      barriers.push(text.length);
      embedded.push(text.length);
      return;
    }
    if (node.nodeName === 'IMG') {
      const url =
        httpUrl(node.getAttribute('src'), baseUrl) ??
        httpUrl(node.getAttribute('data-src'), baseUrl);
      barriers.push(text.length);
      if (url) images.push({ url, altText: node.getAttribute('alt'), position: text.length });
      else unresolved.push(text.length);
      return;
    }
    if (KEEP_EMPTY.has(node.nodeName)) {
      const start = text.length;
      text += node.nodeName === 'BR' ? '\n' : '\n￼\n';
      slots.push({ node, start, end: text.length });
      return;
    }
    const block = BLOCKS.has(node.nodeName);
    if (block) lineBreak();
    for (const child of Array.from(node.childNodes)) visit(child);
    if (block) lineBreak();
  };
  for (const child of Array.from(document.body.childNodes)) visit(child);
  return { text, slots, images, barriers, embedded, unresolved };
}

export type Source = ReturnType<typeof parseSource>;

export function parseSource(html: string, baseUrl: string | null) {
  const load = () => {
    const document = domino.createDocument(html);
    for (const element of Array.from(document.querySelectorAll(EXCLUDED))) element.remove();
    return document;
  };
  const { text, images, barriers } = indexDocument(load(), baseUrl);

  function render(range: Range) {
    const document = load();
    const { slots, embedded, unresolved } = indexDocument(document, baseUrl);
    const lineStart = text.lastIndexOf('\n', range.start - 1) + 1;
    const opening = slots.find((slot) => slot.start <= range.start && range.start < slot.end);
    const start =
      opening?.node.parentElement?.closest('pre') &&
      /^\s*$/u.test(text.slice(lineStart, range.start))
        ? lineStart
        : range.start;
    for (const slot of slots) {
      if (slot.end <= start || slot.start >= range.end) slot.node.remove();
      else if (slot.node instanceof domino.impl.Text) {
        slot.node.data = slot.node.data.slice(
          Math.max(0, start - slot.start),
          Math.min(slot.node.data.length, range.end - slot.start)
        );
      }
    }
    const body = document.body;
    const lists = Array.from(body.querySelectorAll('ol')).map((list) => ({
      list,
      items: Array.from(list.children),
    }));
    for (const anchor of Array.from(body.querySelectorAll('a'))) {
      if (isFootnoteReference(anchor)) {
        anchor.remove();
        continue;
      }
      const href = httpUrl(anchor.getAttribute('href'), baseUrl);
      if (href) anchor.setAttribute('href', href);
      else anchor.replaceWith(...Array.from(anchor.childNodes));
    }
    for (const element of Array.from(body.querySelectorAll(MEDIA))) element.remove();
    for (const element of Array.from(body.querySelectorAll('*')).reverse()) {
      if (!element.textContent && !KEEP_EMPTY.has(element.nodeName)) element.remove();
    }
    for (const { list, items } of lists) {
      const first = items.findIndex((item) => item.parentNode === list);
      if (first > 0) {
        list.setAttribute('start', String((Number(list.getAttribute('start')) || 1) + first));
      }
    }
    const issues = new Set<string>();
    const inside = (position: number) => position > range.start && position < range.end;
    if (embedded.some(inside)) issues.add('Embedded media in the selection needs visual review.');
    if (unresolved.some(inside)) {
      issues.add('An image in the selection has no retrievable URL and needs review.');
    }
    if (body.querySelector('math')) {
      issues.add('The selection contains a formula that needs visual review.');
    }
    const content = turndown.turndown(body).trim();
    const compact = (value: string) => value.replace(/\s/gu, '');
    if (compact(htmlText(renderMarkdown(content))) !== compact(body.textContent ?? '')) {
      issues.add(
        'Some selected text could not be preserved by Markdown conversion. Review the source.'
      );
    }
    return {
      content,
      images: images.filter(
        (image) => image.position >= range.start && image.position <= range.end
      ),
      issues: [...issues],
    };
  }

  return { text, images, barriers, render };
}
