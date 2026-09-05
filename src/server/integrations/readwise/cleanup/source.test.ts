import { describe, expect, test } from 'bun:test';
import { indexText, locate } from './locate';
import { parseSource } from './source';

function restore(html: string, selection: string) {
  const source = parseSource(html, 'https://example.com/articles/story');
  for (const [skip, omitSkippable] of [
    [[], false],
    [source.skippable, true],
    [source.brackets, false],
  ] as const) {
    const match = locate(selection, indexText(source.text, skip));
    if (match.status === 'matched') return source.render(match.range, { omitSkippable });
  }
  throw new Error('Selection not found');
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

  test('moves whitespace outside emphasis delimiters', () => {
    const result = restore(
      '<p>A <em>bold </em>claim and <strong> more</strong>.</p>',
      'A bold claim and more.'
    );
    expect(result.content).toBe('A *bold* claim and **more**.');
    expect(result.issues).toEqual([]);
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
        '<p>Claim<sup class="reference"><a href="https://example.com/articles/story/#cite_note-1">[1]</a></sup> continues.</p>',
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

  test('treats same-page numeric anchors as footnotes and reports their ranges', () => {
    const source = parseSource(
      '<p>A common view<a href="https://example.com/articles/story/">1</a>. Next.</p>',
      'https://example.com/articles/story'
    );
    expect(source.skippable).toEqual([{ start: 13, end: 14 }]);
    expect(source.render({ start: 0, end: 15 }).content).toBe('A common view.');
  });

  test('skips captions and alt text when matching and drops captions from a skipping match', () => {
    const source = parseSource(
      '<p>Alpha.</p><figure><img src="/a.png" alt="HANDS"><figcaption>A caption.</figcaption></figure><p>Beta.</p>',
      'https://example.com/'
    );
    expect(source.text).toBe('Alpha.\nHANDS\nA caption.\nBeta.\n');
    expect(locate('Alpha. Beta.', indexText(source.text)).status).toBe('unmatched');
    const match = locate('Alpha. Beta.', indexText(source.text, source.skippable));
    if (match.status !== 'matched') throw new Error('expected a match');
    const result = source.render(match.range, { omitSkippable: true });
    expect(result.content).toBe('Alpha.\n\nBeta.');
    expect(result.images.map((image) => image.url)).toEqual(['https://example.com/a.png']);
  });

  test('strips brackets that wrap a footnote anchor and indexes them as skippable', () => {
    const source = parseSource(
      '<p>Hard to understand. [<a href="#footnote-1"><sup>1</sup></a>] People assumed.</p>',
      'https://example.com/'
    );
    expect(source.brackets).toHaveLength(2);
    expect(locate('understand. 1 People', indexText(source.text, source.brackets)).status).toBe(
      'matched'
    );
    expect(locate('understand. People', indexText(source.text, source.skippable)).status).toBe(
      'matched'
    );
    expect(source.render({ start: 0, end: source.text.length }).content).toBe(
      'Hard to understand. People assumed.'
    );
  });

  test('skips a paragraph that repeats the figure caption', () => {
    const source = parseSource(
      '<p>Alpha.</p><figure><img src="/a.png"><figcaption>A card.</figcaption></figure><p>A card.</p><p>Beta.</p>',
      'https://example.com/'
    );
    const match = locate('Alpha. Beta.', indexText(source.text, source.skippable));
    if (match.status !== 'matched') throw new Error('expected a match');
    expect(source.render(match.range, { omitSkippable: true }).content).toBe('Alpha.\n\nBeta.');
  });

  test('moves quotes and sentence punctuation outside emphasis', () => {
    expect(
      restore(
        '<p>In <em>Our House\'</em>s intro, <em>"quoted."</em> Done.</p>',
        'In Our House\'s intro, "quoted." Done.'
      ).content
    ).toBe('In *Our House*\'s intro, "*quoted*." Done.');
  });

  test('separates emphasis glued to neighboring words in the markup', () => {
    const result = restore(
      '<p>In<em><a href="/book">Orality</a></em>(1982) and <strong>bold</strong>text.</p>',
      'InOrality(1982) and boldtext.'
    );
    expect(result.content).toBe(
      'In *[Orality](https://example.com/book)*(1982) and **bold** text.'
    );
    expect(result.issues).toEqual([]);
  });

  test('leaves punctuation-only emphasis unwrapped', () => {
    expect(
      restore('<p>Over <strong>rules<em>.</em></strong> end.</p>', 'Over rules. end.').content
    ).toBe('Over **rules**. end.');
  });

  test('keeps a horizontal rule inside the selection and drops one at its edge', () => {
    expect(restore('<p>Alpha.</p><hr><p>Beta.</p>', 'Beta.').content).toBe('Beta.');
    expect(restore('<p>Alpha.</p><hr><p>Beta.</p>', 'Alpha. Beta.').content).toBe(
      'Alpha.\n\n---\n\nBeta.'
    );
    expect(parseSource('<p>Alpha.</p><hr><p>Beta.</p>', null).barriers).toEqual([7]);
  });

  test('matches digit-only markers against parenthesized footnote labels', () => {
    for (const html of [
      '<p>Armor works.(<a href="#fn5">5</a>) A rigid material spreads.</p>',
      '<p>Armor works.<sup><a href="#footnote-5">(5)</a></sup> A rigid material spreads.</p>',
    ]) {
      expect(restore(html, 'Armor works. 5 A rigid material spreads.').content).toBe(
        'Armor works. A rigid material spreads.'
      );
    }
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
    expect(
      restore(
        '<p><a href="javascript:bad()">Two <b>bold</b> words</a> stay.</p>',
        'Two bold words stay.'
      ).content
    ).toBe('Two **bold** words stay.');
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
