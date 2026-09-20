import { describe, expect, test } from 'bun:test';
import { describeOrigin, formatOptions, formatQuestion } from './classify-record-format';

describe('formatQuestion', () => {
  test('labels options by title, disambiguates duplicates, and keeps a no-match option', () => {
    const { question, idsByLabel } = formatQuestion([
      { id: 1, title: 'Articles', description: null },
      { id: 2, title: 'Articles', description: 'Long-form web writing.' },
      { id: 3, title: 'Painting', description: 'A kind of Artwork.' },
    ]);
    expect([...idsByLabel.entries()]).toEqual([
      ['Articles', 1],
      ['Articles (2)', 2],
      ['Painting', 3],
    ]);
    expect(question.criteria['none of these']).toBeString();
    expect(question.criteria['Painting']).toBe('A kind of Artwork.');
  });
});

describe('formatOptions', () => {
  test('builds a structured description from the concept fields, parent, and examples', () => {
    expect(
      formatOptions([
        {
          id: 1,
          title: 'Painting',
          summary: ' A painted work. ',
          sense: null,
          content: 'ignored when a summary exists',
          parent: 'Artwork',
          examples: ['Empty Every Night'],
        },
        {
          id: 2,
          title: 'Websites',
          summary: null,
          sense: null,
          content: null,
          parent: null,
          examples: [],
        },
      ])
    ).toEqual([
      {
        id: 1,
        title: 'Painting',
        description: {
          definition: 'A painted work.',
          kindOf: 'Artwork',
          examples: ['Empty Every Night'],
        },
      },
      { id: 2, title: 'Websites', description: null },
    ]);
  });
});

describe('describeOrigin', () => {
  const empty = {
    readwiseDocuments: [],
    raindropBookmarks: [],
    raindropHighlights: [],
    twitterTweets: [],
    twitterUsers: [],
    githubRepositories: [],
    githubUsers: [],
    lightroomImages: [],
    outgoingLinks: [],
  };

  test('names the source and whether the record is part of a larger one', () => {
    expect(
      describeOrigin({
        ...empty,
        readwiseDocuments: [{ category: 'highlight' }],
        outgoingLinks: [{ predicate: 'contained_by' }],
      })
    ).toBe(
      'a passage highlighted while reading a longer piece; an excerpt or part of a longer piece'
    );
    expect(describeOrigin({ ...empty, raindropBookmarks: [{ type: 'link' }] })).toBe(
      'a bookmarked web page'
    );
    expect(describeOrigin(empty)).toBe('added by hand');
  });
});
