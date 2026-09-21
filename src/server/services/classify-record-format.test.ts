import { describe, expect, test } from 'bun:test';
import {
  describeImages,
  describeOrigin,
  formatOptions,
  formatQuestion,
  rankSuggestions,
} from './classify-record-format';

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
      'a passage highlighted while reading a longer piece; part of a larger collection or work'
    );
    expect(describeOrigin({ ...empty, raindropBookmarks: [{ type: 'link' }] })).toBe(
      'a bookmarked web page'
    );
    expect(describeOrigin(empty)).toBe('added by hand');
  });
});

describe('describeImages', () => {
  test('joins non-empty alt text and returns null when there is none', () => {
    expect(
      describeImages([{ altText: ' A tall tower. ' }, { altText: null }, { altText: 'A pond.' }])
    ).toBe('A tall tower. A pond.');
    expect(describeImages([{ altText: '' }])).toBeNull();
  });
});

describe('rankSuggestions', () => {
  const vocabulary = [
    { id: 1, title: 'Photography', description: null },
    { id: 2, title: 'Place', description: null },
    { id: 3, title: 'Words', description: null },
    { id: 4, title: 'Self', description: null },
  ];
  const idsByLabel = new Map(vocabulary.map((option) => [option.title, option.id]));
  const answer = (noul: number) => ({ type: 'noul' as const, noul });
  const pick = (choice: string) => ({
    type: 'choice' as const,
    choice,
    confidence: 0.7,
    probabilities: { [choice]: 1 },
  });

  test('sorts by probability, keeps formats more likely than not, never the record itself', () => {
    expect(
      rankSuggestions(
        {
          format: pick('Place'),
          '1': answer(0.92),
          '2': answer(0.62),
          '3': answer(0.36),
          '4': answer(0.9),
        },
        vocabulary,
        idsByLabel,
        4
      )
    ).toEqual([
      { id: 1, title: 'Photography', probability: 0.92 },
      { id: 2, title: 'Place', probability: 0.62 },
    ]);
  });

  test('always includes the chosen format, even below the floor, at its own position', () => {
    expect(
      rankSuggestions(
        { format: pick('Words'), '1': answer(0.55), '2': answer(0.1), '3': answer(0.3) },
        vocabulary,
        idsByLabel,
        4
      )
    ).toEqual([
      { id: 1, title: 'Photography', probability: 0.55 },
      { id: 3, title: 'Words', probability: 0.3 },
    ]);
  });
});
