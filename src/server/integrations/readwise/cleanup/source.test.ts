import { describe, expect, test } from 'bun:test';
import { indexSource, locateSelection } from './align';
import { parseSourceDocument } from './source';

function reconstruct(html: string, selection: string) {
  const source = parseSourceDocument(html, 'https://example.com/articles/story');
  const match = locateSelection(selection, indexSource(source.text));
  expect(match.status).toBe('matched');
  if (match.status !== 'matched') throw new Error('Selection did not match');
  return source.render(match.range);
}

describe('source reconstruction', () => {
  test('restores flattened paragraphs and inline links within selection bounds', () => {
    const result = reconstruct(
      '<p>Before. <a href="/author">Ada</a> explains <em>why</em>.</p><p>Then we test.</p><p>After.</p>',
      'Ada explains why.Then we test.'
    );
    expect(result.content).toBe(
      '[Ada](https://example.com/author) explains *why*.\n\nThen we test.'
    );
  });

  test('keeps source code whitespace', () => {
    const result = reconstruct(
      '<pre><code class="language-js">const x = 1;\n  run(x);</code></pre>',
      'const x = 1;  run(x);'
    );
    expect(result.content).toBe('```js\nconst x = 1;\n  run(x);\n```');
    const indented = reconstruct(
      '<pre><code class="language-python">    if ready:\n        run()\n    finish()</code></pre>',
      '    if ready:\n        run()\n    finish()'
    );
    expect(indented.content).toBe('```python\n    if ready:\n        run()\n    finish()\n```');
    expect(indented.issues).toEqual([]);
  });

  test('drops a horizontal rule that ends where the selection begins', () => {
    const result = reconstruct('<p>Alpha.</p><hr><p>Beta.</p>', 'Beta.');
    expect(result.content).toBe('Beta.');
    expect(result.issues).toEqual([]);
  });

  test('preserves list numbering when the selection starts partway through a list', () => {
    const result = reconstruct(
      '<ol start="3"><li>Earlier</li><li>Chosen</li><li>Next</li></ol>',
      'ChosenNext'
    );
    expect(result.content).toBe('4. Chosen\n5. Next');
  });

  test('preserves list numbering after item-level numbering resets', () => {
    const result = reconstruct(
      '<ol start="3"><li value="8">Earlier</li><li>Chosen</li><li>Next</li></ol>',
      'ChosenNext'
    );
    expect(result.content).toBe('9. Chosen\n10. Next');
    expect(result.issues).toEqual([]);
  });

  test('requires review for noncontinuous or reversed list numbers', () => {
    for (const html of [
      '<ol><li value="5">Chosen</li><li value="9">Next</li></ol>',
      '<ol reversed><li>Chosen</li><li>Next</li></ol>',
    ]) {
      const result = reconstruct(html, 'ChosenNext');
      expect(result.issues.some((issue) => issue.includes('numbering'))).toBe(true);
    }
  });

  test('numbers a list whose declared start is not a number', () => {
    const result = reconstruct('<ol start="abc"><li>One</li><li>Two</li></ol>', 'OneTwo');
    expect(result.content).toBe('1. One\n2. Two');
    expect(result.issues).toEqual([]);
  });

  test('removes semantic footnote links without removing mathematical superscripts', () => {
    const result = reconstruct(
      '<p>Area x<sup>2</sup> grows<a role="doc-noteref" href="#fn:1">1</a>.</p>',
      'Area x2 grows1.'
    );
    expect(result.content).toBe('Area x<sup>2</sup> grows.');
  });

  test('keeps prose links whose fragments resemble footnotes', () => {
    const result = reconstruct(
      '<p>Use the <a href="#fn-read">read function</a> here.</p>',
      'Use the read function here.'
    );
    expect(result.content).toBe(
      'Use the [read function](https://example.com/articles/story#fn-read) here.'
    );
    expect(reconstruct('<p>Fact<a href="#fn-1"><sup>[1]</sup></a>.</p>', 'Fact[1].').content).toBe(
      'Fact.'
    );
  });

  test('removes citation references pointing at endnotes', () => {
    const result = reconstruct(
      '<p>Claim<sup class="reference"><a href="#cite_note-1">[1]</a></sup> continues.</p>',
      'Claim[1] continues.'
    );
    expect(result.content).toBe('Claim continues.');
  });

  test('recovers images inside and immediately adjacent to the selected range', () => {
    const result = reconstruct(
      '<img src="/before.png"><p>Start<img src="/inside.png" alt="Diagram">end.</p><img src="/after.png">',
      'Startend.'
    );
    expect(result.images.map((image) => image.url)).toEqual([
      'https://example.com/before.png',
      'https://example.com/inside.png',
    ]);
    expect(result.content).toBe('Startend.');
  });

  test('recovers lazy-loaded images inside a selection', () => {
    const result = reconstruct(
      '<p>Alpha.</p><img data-src="/diagram.png" alt="Diagram"><p>Beta.</p>',
      'Alpha.Beta.'
    );
    expect(result.images.map((image) => image.url)).toEqual(['https://example.com/diagram.png']);
    expect(result.issues).toEqual([]);
    const placeholder = reconstruct(
      '<p>Alpha.</p><img src="data:image/gif;base64,YQ==" data-src="/diagram.png"><p>Beta.</p>',
      'Alpha.Beta.'
    );
    expect(placeholder.images.map((image) => image.url)).toEqual([
      'https://example.com/diagram.png',
    ]);
  });

  test('requires review for unresolved images only inside the selected range', () => {
    const result = reconstruct('<p>Alpha.</p><img><p>Beta.</p>', 'Alpha.Beta.');
    expect(result.images).toEqual([]);
    expect(result.issues.some((issue) => issue.includes('image'))).toBe(true);
    expect(reconstruct('<img><p>Selected.</p><img>', 'Selected.').issues).toEqual([]);
  });

  test('reports resolved and unresolved image boundaries without changing selection text', () => {
    const source = parseSourceDocument(
      '<p>Alpha<img src="/diagram.png">Beta<img>Gamma</p>',
      'https://example.com/'
    );
    expect(source.text).toBe('AlphaBetaGamma\n');
    expect(source.mediaBoundaries).toEqual([5, 9]);
  });

  test('excludes scripts and unsafe links', () => {
    const result = reconstruct(
      '<script>bad()</script><p><a href="javascript:bad()">Words</a> stay.</p>',
      'Words stay.'
    );
    expect(result.content).toBe('Words stay.');
  });

  test('drops embedded media instead of linking its source', () => {
    const result = reconstruct(
      '<p>A.<video src="javascript:alert(1)">Play</video>B.</p>',
      'A.PlayB.'
    );
    expect(result.content).not.toContain('javascript:');
    expect(result.issues).toContain('Embedded media in the selection needs visual review.');
  });

  test('flags embedded media inside a selection and exposes its merge boundary', () => {
    const html = '<p>Alpha.</p><iframe src="https://example.com/video"></iframe><p>Beta.</p>';
    const result = reconstruct(html, 'Alpha.Beta.');
    expect(result.issues).toContain('Embedded media in the selection needs visual review.');
    expect(parseSourceDocument(html, null).mediaBoundaries).toHaveLength(1);
  });
});
