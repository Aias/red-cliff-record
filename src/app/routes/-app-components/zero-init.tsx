import type { Zero } from '@rocicorp/zero';
import { ZeroProvider } from '@rocicorp/zero/react';
import type { ReactNode } from 'react';
import { markSynced } from '@/lib/sync-status';
import type { ZeroAppContext } from '@/shared/zero/context';
import { mutators } from '@/shared/zero/mutators';
import { queries } from '@/shared/zero/queries';
import { schema, type Schema } from '@/shared/zero/schema.gen';

/** The client has no mutator context; the server builds one per request. */
const context: ZeroAppContext | undefined = undefined;

/** The synced graph is small (~tens of MB), so preload all of it up front
 * and every view resolves locally without a network roundtrip. Completion
 * of all four preloads drives the app-wide sync status. */
function preload(zero: Zero<Schema, undefined, ZeroAppContext | undefined>) {
  const preloads = [
    zero.preload(queries.allRecords()),
    zero.preload(queries.allLinks()),
    zero.preload(queries.allMedia()),
    zero.preload(queries.allEloMatchups()),
  ];
  void Promise.all(preloads.map(({ complete }) => complete)).then(markSynced);
}

export function ZeroInit({ children }: { children: ReactNode }) {
  return (
    <ZeroProvider
      schema={schema}
      userID="rcr"
      cacheURL={process.env.PUBLIC_ZERO_CACHE_URL}
      mutators={mutators}
      context={context}
      init={preload}
    >
      {children}
    </ZeroProvider>
  );
}
