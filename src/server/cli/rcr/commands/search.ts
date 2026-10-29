import { RecordTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import { Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { idsArgument, limitFlag } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { respond, success } from '../lib/output';
import type { ResultValue } from '../lib/types';

const caller = createCLICaller();

const queryArgument = Argument.String('query').pipe(
  Argument.withDescription('Search terms, joined with spaces'),
  Argument.variadic({ min: 1 })
);
const limitOption = limitFlag(20);

type SimilarMatches = {
  id: number;
  similar: Awaited<ReturnType<typeof caller.search.byRecordId>>;
};

const text = Command.make(
  'text',
  {
    query: queryArgument,
    limit: limitOption,
    type: Flag.Literals('type', RecordTypeSchema.options).pipe(
      Flag.withDescription('Only records of this type'),
      Flag.optional
    ),
  },
  ({ query, limit, type }) =>
    respond(async () => {
      const results = await caller.search.byTextQuery({
        query: query.join(' '),
        filters: { recordType: Option.getOrUndefined(type) },
        limit,
      });
      return success(results, { count: results.length, limit });
    })
).pipe(Command.withDescription('Full-text trigram search'));

const semantic = Command.make(
  'semantic',
  {
    query: queryArgument,
    limit: limitOption,
    exclude: Flag.Int('exclude').pipe(
      Flag.withDescription('Record ID to omit from results; repeatable'),
      Flag.atLeast(0)
    ),
  },
  ({ query, limit, exclude }) =>
    respond(async () => {
      try {
        const ids = await caller.search.byVector({
          query: query.join(' '),
          limit,
          exclude: [...exclude],
        });
        const results = await Promise.all(ids.map(({ id }) => caller.records.get({ id })));
        return success(results, { count: results.length, limit });
      } catch (e) {
        if (e instanceof TRPCError) throw createError('EMBEDDING_ERROR', e.message);
        throw e;
      }
    })
).pipe(
  Command.withDescription('Semantic vector search using embeddings'),
  Command.withExamples([
    {
      command: 'rcr search semantic gardening --exclude 12 --exclude 34',
      description: 'Search by meaning, omitting records 12 and 34',
    },
  ])
);

const similar = Command.make(
  'similar',
  { ids: idsArgument, limit: limitOption },
  ({ ids, limit }) =>
    respond<ResultValue>(async () => {
      const results = await Promise.all(
        ids.map(async (id): Promise<SimilarMatches | { id: number; error: string }> => {
          try {
            return { id, similar: await caller.search.byRecordId({ id, limit }) };
          } catch (e) {
            if (!(e instanceof TRPCError)) throw e;
            return { id, error: e.code === 'NOT_FOUND' ? e.code : e.message };
          }
        })
      );
      const [only] = results;
      if (only && results.length === 1) {
        if ('error' in only) {
          throw only.error === 'NOT_FOUND'
            ? createError('NOT_FOUND', `Record ${only.id} not found`)
            : createError('EMBEDDING_ERROR', only.error);
        }
        return success(only.similar, { count: only.similar.length, limit });
      }
      return success(results, { count: results.length, limit });
    })
).pipe(
  Command.withDescription(
    'Find records similar to the given records; one ID returns the matches directly, several return {id, similar} per ID'
  )
);

export const search = Command.make(
  'search',
  { query: queryArgument, limit: limitOption },
  ({ query, limit }) =>
    respond(async () => {
      const { ids } = await caller.records.list({ searchQuery: query.join(' '), limit });
      const results = await Promise.all(ids.map(({ id }) => caller.records.get({ id })));
      return success(results, { count: results.length, limit });
    })
).pipe(
  Command.withDescription('Hybrid search (trigram and vector, merged with RRF)'),
  Command.withExamples([
    { command: 'rcr search machine learning --limit 5', description: 'Hybrid search' },
    { command: 'rcr search text design --type concept', description: 'Trigram search by type' },
    { command: 'rcr search similar 123 456', description: 'Records similar to 123 and 456' },
  ]),
  Command.withSubcommands([text, semantic, similar])
);
