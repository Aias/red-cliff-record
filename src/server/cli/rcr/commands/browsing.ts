import { Argument, Command } from 'effect/cli';
import { dateArgument } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { respond, success } from '../lib/output';

const caller = createCLICaller();

const patternArgument = Argument.String('pattern').pipe(
  Argument.withDescription('SQL LIKE pattern (% is a wildcard)')
);

const daily = Command.make(
  'daily',
  {
    date: dateArgument,
  },
  ({ date }) => respond(async () => success(await caller.browsing.dailySummary({ date })))
).pipe(
  Command.withDescription('Daily browsing summary'),
  Command.withExamples([{ command: 'rcr browsing daily 2026-01-03' }])
);

const omit = Command.make('omit', {}, () =>
  respond(async () => {
    const result = await caller.browsing.listOmitPatterns();
    return success(result, { count: result.length });
  })
).pipe(Command.withDescription('List omit patterns'));

const omitAdd = Command.make('omit-add', { pattern: patternArgument }, ({ pattern }) =>
  respond(async () => success(await caller.browsing.upsertOmitPattern({ pattern })))
).pipe(
  Command.withDescription('Add a pattern to the omit list'),
  Command.withExamples([{ command: `rcr browsing omit-add '%example.com%'` }])
);

const omitDelete = Command.make(
  'omit-delete',
  { patterns: patternArgument.pipe(Argument.variadic({ min: 1 })) },
  ({ patterns }) =>
    respond(async () => {
      const result = await caller.browsing.deleteOmitPatterns([...patterns]);
      return success(result, { count: result.length });
    })
).pipe(
  Command.withDescription('Delete patterns from the omit list'),
  Command.withExamples([{ command: `rcr browsing omit-delete '%example.com%' '%test.com%'` }])
);

export const browsing = Command.make('browsing').pipe(
  Command.withDescription('Browsing history'),
  Command.withSubcommands([daily, omit, omitAdd, omitDelete])
);
