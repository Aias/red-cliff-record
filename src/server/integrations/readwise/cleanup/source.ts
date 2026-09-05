import type { Element, Root, RootContent } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import MarkdownIt from 'markdown-it';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { SourceRange } from './align';

const markdownParser = new MarkdownIt({ html: true });
export const renderMarkdown = (content: string) => markdownParser.render(content);

const excludedElements = new Set([
  'button',
  'form',
  'head',
  'iframe',
  'input',
  'noscript',
  'script',
  'select',
  'style',
  'template',
  'textarea',
]);

const blockElements = new Set([
  'article',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

type SourceImage = { url: string; altText: string | null; position: number };

const httpUrl = (value: unknown, baseUrl: string | null) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl ?? undefined);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

function textContent(node: RootContent): string {
  if (node.type === 'text') return node.value;
  return node.type === 'element' ? node.children.map(textContent).join('') : '';
}

function isFootnoteReference(element: Element) {
  return (
    element.properties.role === 'doc-noteref' ||
    element.properties.dataFootnoteRef !== undefined ||
    (typeof element.properties.href === 'string' &&
      /^#(?:user-content-)?(?:fn(?:ref)?|(?:cite[_-])?note|endnote|footnote)[:_\d-]/i.test(
        element.properties.href
      ) &&
      /^\s*\[?\s*(?:\d+|[*†‡]+)\s*\]?\s*$/u.test(textContent(element)))
  );
}

export function parseSourceDocument(html: string, baseUrl: string | null) {
  const tree = fromHtml(html, { fragment: true });
  const ranges = new Map<RootContent, SourceRange>();
  const images: SourceImage[] = [];
  const mediaBoundaries: number[] = [];
  const unresolvedImages: number[] = [];
  const embeddedMedia: number[] = [];
  let text = '';

  const lineBreak = () => {
    if (text && !text.endsWith('\n')) text += '\n';
  };

  function indexNode(node: RootContent): void {
    if (node.type === 'comment' || node.type === 'doctype') return;
    if (
      node.type === 'element' &&
      ['audio', 'embed', 'iframe', 'object', 'svg', 'video'].includes(node.tagName)
    ) {
      mediaBoundaries.push(text.length);
      embeddedMedia.push(text.length);
    }
    if (node.type === 'element' && excludedElements.has(node.tagName)) return;
    if (node.type === 'element' && blockElements.has(node.tagName)) lineBreak();
    const start = text.length;
    if (node.type === 'text') {
      text += node.value;
    } else {
      if (node.tagName === 'br') text += '\n';
      if (node.tagName === 'hr') text += '\n\uFFFC\n';
      if (node.tagName === 'img') {
        mediaBoundaries.push(start);
        const url =
          httpUrl(node.properties.src, baseUrl) ?? httpUrl(node.properties.dataSrc, baseUrl);
        if (url) {
          images.push({
            url,
            altText: typeof node.properties.alt === 'string' ? node.properties.alt : null,
            position: start,
          });
        } else {
          unresolvedImages.push(start);
        }
      }
      for (const child of node.children) indexNode(child);
    }
    ranges.set(node, { start, end: text.length });
    if (node.type === 'element' && blockElements.has(node.tagName)) lineBreak();
  }

  for (const node of tree.children) indexNode(node);

  function render(range: SourceRange) {
    const lineStart = text.lastIndexOf('\n', range.start - 1) + 1;
    const startsInCode = [...ranges].some(
      ([node, position]) =>
        node.type === 'element' &&
        node.tagName === 'pre' &&
        lineStart >= position.start &&
        range.start < position.end
    );
    const selectionRange =
      startsInCode && /^\s*$/u.test(text.slice(lineStart, range.start))
        ? { ...range, start: lineStart }
        : range;
    const issues = new Set<string>();
    if (embeddedMedia.some((position) => position > range.start && position < range.end)) {
      issues.add('Embedded media in the selection needs visual review.');
    }
    if (unresolvedImages.some((position) => position > range.start && position < range.end)) {
      issues.add('An image in the selection has no retrievable URL and needs review.');
    }

    function crop(node: RootContent): RootContent[] {
      const position = ranges.get(node);
      if (!position || position.end <= selectionRange.start || position.start >= selectionRange.end)
        return [];
      if (node.type === 'text') {
        const value = node.value.slice(
          Math.max(0, selectionRange.start - position.start),
          Math.min(node.value.length, selectionRange.end - position.start)
        );
        return value ? [{ ...node, value }] : [];
      }
      if (node.type !== 'element' || isFootnoteReference(node)) return [];
      if (['audio', 'embed', 'img', 'object', 'video'].includes(node.tagName)) return [];
      if (['math', 'svg'].includes(node.tagName)) {
        issues.add('The selection contains a formula or vector image that needs visual review.');
      }
      const cropped = new Map<RootContent, RootContent[]>(
        node.children.map((child) => [child, crop(child)])
      );
      const children = [...cropped.values()].flat().filter((child) => child.type !== 'doctype');
      if (children.length === 0 && !['br', 'hr'].includes(node.tagName)) return [];
      const properties = { ...node.properties };
      if (node.tagName === 'a') {
        const href = httpUrl(properties.href, baseUrl);
        if (href) properties.href = href;
        else return children;
      }
      if (node.tagName === 'ol') {
        const items = node.children
          .filter((child) => child.type === 'element')
          .filter((child) => child.tagName === 'li');
        const selectedValues: number[] = [];
        const start = Number(properties.start);
        let value = Number.isInteger(start) ? start : properties.reversed ? items.length : 1;
        for (const item of items) {
          const explicitValue = Number(item.properties.value);
          if (Number.isInteger(explicitValue)) value = explicitValue;
          if (cropped.get(item)?.length) selectedValues.push(value);
          value += properties.reversed ? -1 : 1;
        }
        const firstValue = selectedValues[0];
        if (firstValue !== undefined) {
          properties.start = firstValue;
          if (selectedValues.some((selectedValue, index) => selectedValue !== firstValue + index)) {
            issues.add('The selected list changes numbering in a way that needs review.');
          }
        }
      }
      return [{ ...node, properties, children }];
    }

    const selection: Root = { type: 'root', children: tree.children.flatMap(crop) };
    const markdown = toMdast(selection, {
      handlers: {
        sub: (state, element) => [
          { type: 'html', value: '<sub>' },
          ...state.all(element),
          { type: 'html', value: '</sub>' },
        ],
        sup: (state, element) => [
          { type: 'html', value: '<sup>' },
          ...state.all(element),
          { type: 'html', value: '</sup>' },
        ],
      },
    });
    const content = toMarkdown(markdown, { extensions: [gfmToMarkdown()], bullet: '-' }).trim();
    const restored = fromHtml(renderMarkdown(content), { fragment: true });
    const compactText = (root: Root) => root.children.map(textContent).join('').replace(/\s/gu, '');
    if (compactText(selection) !== compactText(restored)) {
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

  return { text, images, mediaBoundaries, render };
}
