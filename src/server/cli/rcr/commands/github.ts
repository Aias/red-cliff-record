import { Argument, Command } from 'effect/cli';
import { dateArgument } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { respond, success } from '../lib/output';

const caller = createCLICaller();

const daily = Command.make(
  'daily',
  {
    date: dateArgument,
  },
  ({ date }) =>
    respond(async () => {
      const result = await caller.github.dailySummary({ date });
      return success(result, { count: result.commits.length });
    })
).pipe(
  Command.withDescription('Daily commit summary'),
  Command.withExamples([{ command: 'rcr github daily 2026-01-03' }])
);

const get = Command.make(
  'get',
  { id: Argument.String('id').pipe(Argument.withDescription('Commit ID')) },
  ({ id }) => respond(async () => success(await caller.github.getCommit({ id })))
).pipe(Command.withDescription('Get a commit with full details'));

export const github = Command.make('github').pipe(
  Command.withDescription('GitHub commit history'),
  Command.withSubcommands([daily, get])
);
