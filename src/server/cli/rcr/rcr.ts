import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Cause, Effect, Layer, Runtime } from 'effect';
import { CliConfig, CliError, CliOutput, Command, Flag, GlobalFlag } from 'effect/cli';
import { appLayer } from '@/server/integrations/runtime/runtime';
import packageJson from '../../../../package.json' with { type: 'json' };
import { browsing } from './commands/browsing';
import { db } from './commands/db';
import { enrich } from './commands/enrich';
import { fetch } from './commands/fetch';
import { github } from './commands/github';
import { links } from './commands/links';
import { media } from './commands/media';
import { readwise } from './commands/readwise';
import { records } from './commands/records';
import { search } from './commands/search';
import { sync } from './commands/sync';
import { createError } from './lib/errors';
import { Raw, writeError } from './lib/output';

const Dev = GlobalFlag.Setting('dev')({
  flag: Flag.Boolean('dev').pipe(
    Flag.withDescription('Use the development database (DATABASE_URL_DEV)'),
    Flag.withDefault(false)
  ),
});

const rcr = Command.make('rcr').pipe(
  Command.withDescription(
    'Red Cliff Record knowledge base. Results print to stdout as {data, meta} JSON; errors print to stderr as {error: {code, message, details}} JSON with exit code 1.'
  ),
  Command.withSubcommands([
    records,
    search,
    links,
    media,
    readwise,
    browsing,
    github,
    sync,
    enrich,
    db,
    fetch,
  ]),
  Command.withGlobalFlags([Raw, Dev])
);

const invalidInvocationPresenter = CliOutput.layerPresenter({
  present: (event) =>
    event._tag === 'InvalidInvocation'
      ? writeError(
          createError(
            event.errors.some((error) => error._tag === 'UnknownSubcommand')
              ? 'UNKNOWN_COMMAND'
              : 'VALIDATION_ERROR',
            event.errors.map((error) => error.message).join('\n'),
            `Run '${event.commandPath.join(' ')} --help' for usage.`
          )
        )
      : CliOutput.defaultPresenter.present(event),
});

const program = Command.runWith(rcr, { version: packageJson.version })(process.argv.slice(2)).pipe(
  Effect.catchCause((cause) => {
    if (Cause.hasInterruptsOnly(cause)) return Effect.failCause(cause);
    const error = Cause.squash(cause);
    if (CliError.isCliError(error) && error._tag === 'ShowHelp') {
      return error.errors.length === 0 ? Effect.void : Effect.failCause(cause);
    }
    return writeError(error).pipe(Effect.andThen(Effect.failCause(cause)));
  }),
  Effect.provide(
    Layer.mergeAll(
      BunServices.layer,
      CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
      invalidInvocationPresenter,
      appLayer
    )
  )
);

BunRuntime.runMain(program, {
  disableErrorReporting: true,
  teardown: (exit) => Runtime.defaultTeardown(exit, (code) => process.exit(code)),
});
