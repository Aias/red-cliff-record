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
const glued = (sibling: ChildNode | null, edge: RegExp) =>
  sibling instanceof domino.impl.Text && edge.test(sibling.data);
const wrap = (content: string, delimiter: string, node: TurndownService.Node) => {
  const [, lead = '', body = '', trail = ''] =
    /^([\s"'“”‘’]*)([\s\S]*?)([\s"'“”‘’.,;:!?]*)$/u.exec(content) ?? [];
  if (!/[\p{L}\p{N}]/u.test(body)) return content;
  const own = node.textContent ?? '';
  const before =
    !lead && !/^\s/u.test(own) && glued(node.previousSibling, /[\p{L}\p{N}]$/u) ? ' ' : '';
  const after = !trail && !/\s$/u.test(own) && glued(node.nextSibling, /^[\p{L}\p{N}]/u) ? ' ' : '';
  return `${before}${lead}${delimiter}${body}${delimiter}${trail}${after}`;
};
const turndown = new TurndownService({
  bulletListMarker: BULLET,
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  headingStyle: 'atx',
  hr: '---',
})
  .use(gfm)
  .keep(['sub', 'sup'])
  .addRule('emphasis', {
    filter: ['em', 'i'],
    replacement: (content, node) => wrap(content, '*', node),
  })
  .addRule('strong', {
    filter: ['strong', 'b'],
    replacement: (content, node) => wrap(content, '**', node),
  })
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
const FOOTNOTE_LABEL = /^\s*[[(]?\s*(?:\d+|[*†‡]+)\s*[\])]?\s*$/u;

export type SourceImage = { url: string; altText: string | null; position: number };
type Slot = { node: ChildNode; start: number; end: number };
type Rule = { node: ChildNode; position: number };

const httpUrl = (value: string | null, baseUrl: string | null) => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, baseUrl ?? undefined);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const urlHash = (href: string, baseUrl: string | null) => {
  try {
    return new URL(href, baseUrl ?? 'https://readwise.invalid/').hash;
  } catch {
    return '';
  }
};

const samePage = (href: string, baseUrl: string | null) => {
  if (!baseUrl) return false;
  try {
    const strip = (url: URL) => url.origin + url.pathname.replace(/\/$/, '') + url.search;
    return strip(new URL(href, baseUrl)) === strip(new URL(baseUrl));
  } catch {
    return false;
  }
};

const isFootnoteReference = (anchor: Element, baseUrl: string | null) => {
  const href = anchor.getAttribute('href') ?? '';
  return (
    anchor.getAttribute('role') === 'doc-noteref' ||
    anchor.hasAttribute('data-footnote-ref') ||
    (FOOTNOTE_LABEL.test(anchor.textContent ?? '') &&
      (FOOTNOTE_HREF.test(urlHash(href, baseUrl)) || samePage(href, baseUrl)))
  );
};

function indexDocument(document: Document, baseUrl: string | null) {
  let text = '';
  const slots: Slot[] = [];
  const rules: Rule[] = [];
  const images: SourceImage[] = [];
  const barriers: number[] = [];
  const embedded: number[] = [];
  const unresolved: number[] = [];
  const skippable: Range[] = [];
  const links: Range[] = [];
  const captions: Element[] = [];
  const anchors: Range[] = [];
  let lastCaption = '';
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
      if (url) {
        images.push({
          url,
          altText: node.getAttribute('alt')?.trim() || null,
          position: text.length,
        });
      } else unresolved.push(text.length);
      const alt = node.getAttribute('alt')?.trim();
      if (alt) {
        skippable.push({ start: text.length, end: text.length + alt.length });
        text += alt;
      }
      return;
    }
    if (node.nodeName === 'HR') {
      lineBreak();
      barriers.push(text.length);
      rules.push({ node, position: text.length });
      return;
    }
    if (node.nodeName === 'BR') {
      const start = text.length;
      text += '\n';
      slots.push({ node, start, end: text.length });
      return;
    }
    const block = BLOCKS.has(node.nodeName);
    if (block) lineBreak();
    const start = text.length;
    for (const child of Array.from(node.childNodes)) visit(child);
    if (node.nodeName === 'A') links.push({ start, end: text.length });
    const caption =
      node.nodeName === 'FIGCAPTION' ||
      (node.nodeName === 'P' &&
        lastCaption !== '' &&
        (node.textContent ?? '').trim() === lastCaption);
    if (node.nodeName === 'FIGCAPTION') lastCaption = (node.textContent ?? '').trim();
    else if (block && node.nodeName !== 'FIGURE' && !caption) lastCaption = '';
    const footnote = node.nodeName === 'A' && isFootnoteReference(node, baseUrl);
    if (footnote) anchors.push({ start, end: text.length });
    if (caption || footnote) skippable.push({ start, end: text.length });
    if (caption) captions.push(node);
    if (block) lineBreak();
  };
  for (const child of Array.from(document.body.childNodes)) visit(child);
  const brackets: Range[] = [];
  for (const anchor of anchors) {
    for (let at = anchor.start; at < anchor.end; at++) {
      if (!/\d/u.test(text.charAt(at))) brackets.push({ start: at, end: at + 1 });
    }
    const open = text.slice(0, anchor.start).search(/[[(]\s*$/u);
    const close = text.slice(anchor.end).search(/^\s*[\])]/u);
    if (open === -1 || close === -1) continue;
    const closeAt = anchor.end + text.slice(anchor.end).search(/[\])]/u);
    brackets.push({ start: open, end: open + 1 }, { start: closeAt, end: closeAt + 1 });
  }
  skippable.push(...brackets);
  return {
    text,
    slots,
    rules,
    images,
    barriers,
    embedded,
    unresolved,
    skippable,
    brackets,
    links,
    captions,
  };
}

export type Source = ReturnType<typeof parseSource>;

export function parseSource(html: string, baseUrl: string | null) {
  const load = () => {
    const document = domino.createDocument(html);
    for (const element of Array.from(document.querySelectorAll('[id]')))
      element.removeAttribute('id');
    for (const element of Array.from(document.querySelectorAll(EXCLUDED))) element.remove();
    return document;
  };
  const { text, images, barriers, skippable, brackets, links } = indexDocument(load(), baseUrl);

  function render(range: Range, { omitSkippable = false } = {}) {
    const document = load();
    const { slots, rules, embedded, unresolved, captions } = indexDocument(document, baseUrl);
    const lineStart = text.lastIndexOf('\n', range.start - 1) + 1;
    const opening = slots.find((slot) => slot.start <= range.start && range.start < slot.end);
    const start =
      opening?.node.parentElement?.closest('pre') &&
      /^\s*$/u.test(text.slice(lineStart, range.start))
        ? lineStart
        : range.start;
    for (const rule of rules) {
      if (rule.position <= start || rule.position >= range.end) rule.node.remove();
    }
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
      if (isFootnoteReference(anchor, baseUrl)) {
        const { previousSibling, nextSibling } = anchor;
        if (
          previousSibling instanceof domino.impl.Text &&
          nextSibling instanceof domino.impl.Text
        ) {
          previousSibling.data = previousSibling.data.replace(/[[(]\s*$/u, '');
          nextSibling.data = nextSibling.data.replace(/^\s*[\])]/u, '');
        }
        anchor.remove();
        continue;
      }
      const href = httpUrl(anchor.getAttribute('href'), baseUrl);
      if (href) {
        anchor.setAttribute('href', href);
        continue;
      }
      while (anchor.firstChild) anchor.parentNode?.insertBefore(anchor.firstChild, anchor);
      anchor.remove();
    }
    for (const element of Array.from(body.querySelectorAll(MEDIA))) element.remove();
    if (omitSkippable) for (const element of captions) element.remove();
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

  return { text, images, barriers, skippable, brackets, links, render };
}
