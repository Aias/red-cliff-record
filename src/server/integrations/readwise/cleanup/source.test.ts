import { describe, expect, test } from 'bun:test';
import { indexText, locate } from './locate';
import { parseSource } from './source';

function restore(html: string, selection: string) {
  const source = parseSource(html, 'https://example.com/articles/story');
  const match = locate(selection, indexText(source.text));
  if (match.status !== 'matched') throw new Error(`Selection ${match.status}`);
  return source.render(match.range);
}

describe('source rendering', () => {
  test('restores paragraphs, links, and emphasis within the selection', () => {
    const result = restore(
      '<p>Before. <a href="/author">Ada</a> explains <em>why</em>.</p><p>Then we test.</p><p>After.</p>',
      'Ada explains why.Then we test.'
    );
    expect(result.content).toBe(
      '[Ada](https://example.com/author) explains *why*.\n\nThen we test.'
    );
  });

  test('keeps code whitespace and language', () => {
    const result = restore(
      '<pre><code class="language-python">    if ready:\n        run()\n    finish()</code></pre>',
      '    if ready:\n        run()\n    finish()'
    );
    expect(result.content).toBe('```python\n    if ready:\n        run()\n    finish()\n```');
    expect(result.issues).toEqual([]);
  });

  test('numbers a partially selected ordered list from its first selected item', () => {
    const result = restore(
      '<ol start="3"><li>Earlier</li><li>Chosen</li><li>Next</li></ol>',
      'ChosenNext'
    );
    expect(result.content).toBe('4. Chosen\n5. Next');
  });

  test('drops footnote references but keeps superscripts and prose fragment links', () => {
    expect(
      restore(
        '<p>Area x<sup>2</sup> grows<a role="doc-noteref" href="#fn:1">1</a>.</p>',
        'Area x2 grows1.'
      ).content
    ).toBe('Area x<sup>2</sup> grows.');
    expect(
      restore(
        '<p>Claim<sup class="reference"><a href="#cite_note-1">[1]</a></sup> continues.</p>',
        'Claim[1] continues.'
      ).content
    ).toBe('Claim continues.');
    expect(
      restore(
        '<p>Use the <a href="#fn-read">read function</a> here.</p>',
        'Use the read function here.'
      ).content
    ).toBe('Use the [read function](https://example.com/articles/story#fn-read) here.');
  });

  test('recovers images inside and adjacent to the selection as attachments', () => {
    const result = restore(
      '<img src="/before.png"><p>Start<img src="/inside.png" alt="Diagram">end.</p><img src="/after.png">',
      'Startend.'
    );
    expect(result.content).toBe('Startend.');
    expect(result.images.map((image) => image.url)).toEqual([
      'https://example.com/before.png',
      'https://example.com/inside.png',
    ]);
  });

  test('prefers lazy-loaded image sources over placeholders', () => {
    const result = restore(
      '<p>Alpha.</p><img src="data:image/gif;base64,YQ==" data-src="/diagram.png"><p>Beta.</p>',
      'Alpha.Beta.'
    );
    expect(result.images.map((image) => image.url)).toEqual(['https://example.com/diagram.png']);
  });

  test('flags unresolved images and embedded media inside the selection only', () => {
    expect(restore('<p>Alpha.</p><img><p>Beta.</p>', 'Alpha.Beta.').issues).toEqual([
      'An image in the selection has no retrievable URL and needs review.',
    ]);
    expect(restore('<img><p>Selected.</p><img>', 'Selected.').issues).toEqual([]);
    expect(
      restore(
        '<p>Alpha.</p><iframe src="https://example.com/video"></iframe><p>Beta.</p>',
        'Alpha.Beta.'
      ).issues
    ).toEqual(['Embedded media in the selection needs visual review.']);
  });

  test('unwraps unsafe links and excludes scripts', () => {
    const result = restore(
      '<script>bad()</script><p><a href="javascript:bad()">Words</a> stay.</p>',
      'Words stay.'
    );
    expect(result.content).toBe('Words stay.');
  });

  test('reports media positions as continuity barriers', () => {
    const source = parseSource(
      '<p>Alpha<img src="/diagram.png">Beta<img>Gamma</p>',
      'https://example.com/'
    );
    expect(source.text).toBe('AlphaBetaGamma\n');
    expect(source.barriers).toEqual([5, 9]);
  });

  test('escapes literal Markdown characters in prose and keeps them inside code', () => {
    expect(restore('<p>1. Dogs have tails.</p>', '1. Dogs have tails.').content).toBe(
      '1\\. Dogs have tails.'
    );
    expect(restore('<pre><code>[ref](url)</code></pre>', '[ref](url)').content).toBe(
      '```\n[ref](url)\n```'
    );
  });
});
