import type { RecordType } from '@hozo';
import { useQueryClient } from '@tanstack/react-query';
import { EqualIcon, SkipForwardIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { useTRPC } from '@/app/trpc';
import { Button } from '@/components/button';
import { Placeholder } from '@/components/placeholder';
import { Spinner } from '@/components/spinner';
import { useZeroMutate } from '@/lib/hooks/zero-mutate';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import type { DbId } from '@/shared/types/api';
import { mutators } from '@/shared/zero/mutators';
import { styled } from '@/styled-system/jsx';
import { RecordDisplay } from '../../records/-components/record-display';
import { RelationsPreview } from '../../records/-components/relations-preview';

/** Recent focused-burst opponents excluded from reselection. */
const EXCLUDE_MEMORY = 20;

type Matchup = { aId: DbId; bId: DbId } | null;

interface SessionState {
  pair: Matchup;
  excludeIds: DbId[];
}

// Module-scope sessions so leaving the arena (e.g. to inspect a record) and
// coming back resumes the matchup that was on screen instead of restarting.
const sessions = new Map<string, SessionState>();

function getSession(key: string): SessionState {
  let session = sessions.get(key);
  if (!session) {
    session = { pair: null, excludeIds: [] };
    sessions.set(key, session);
  }
  return session;
}

export function ArenaSession({ type, focus }: { type: RecordType; focus?: DbId }) {
  const sessionKey = `${type}:${focus ?? 'open'}`;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [pair, setPair] = useState<Matchup>(() => sessions.get(sessionKey)?.pair ?? null);
  const [loading, setLoading] = useState(() => !sessions.get(sessionKey)?.pair);
  const zeroMutate = useZeroMutate();

  const loadNext = (excludeIds: DbId[]) => {
    const session = getSession(sessionKey);
    session.excludeIds = excludeIds;
    void queryClient
      .fetchQuery(
        trpc.elo.getMatchup.queryOptions(
          { recordType: type, focusRecordId: focus, excludeIds },
          { staleTime: 0, gcTime: 0 }
        )
      )
      .then((next) => {
        session.pair = next;
        setPair(next);
      })
      .finally(() => setLoading(false));
  };

  const loadInitial = useEffectEvent(() => {
    if (!pair) loadNext(getSession(sessionKey).excludeIds);
  });
  useEffect(() => {
    loadInitial();
  }, []);

  const advance = () => {
    if (!pair) return;
    setLoading(true);
    loadNext(
      focus
        ? [...getSession(sessionKey).excludeIds, pair.bId].slice(-EXCLUDE_MEMORY)
        : [pair.aId, pair.bId]
    );
  };

  const busy = loading || !pair;
  const pick = (winnerId: DbId, loserId: DbId) => {
    if (busy) return;
    void zeroMutate(mutators.elo.submitMatchup({ winnerId, loserId }));
    advance();
  };
  const pickLeft = () => pair && pick(pair.aId, pair.bId);
  const pickRight = () => pair && pick(pair.bId, pair.aId);
  const draw = () => {
    if (!pair || loading) return;
    void zeroMutate(mutators.elo.submitMatchup({ drawIds: [pair.aId, pair.bId] }));
    advance();
  };
  const skip = () => {
    if (busy) return;
    advance();
  };

  useKeyboardShortcut('arrowleft', pickLeft, {
    description: 'Pick the left record',
    category: 'Arena',
  });
  useKeyboardShortcut('arrowright', pickRight, {
    description: 'Pick the right record',
    category: 'Arena',
  });
  useKeyboardShortcut('d', draw, { description: 'Declare a draw', category: 'Arena' });
  useKeyboardShortcut('s', skip, { description: 'Skip the matchup', category: 'Arena' });

  if (!pair) {
    return (
      <Placeholder css={{ flexGrow: '1' }}>
        {loading ? <Spinner /> : 'Not enough curated records to rank.'}
      </Placeholder>
    );
  }

  return (
    <>
      <styled.div
        css={{
          display: 'grid',
          gridTemplateColumns: '[minmax(0, 1fr) auto minmax(0, 1fr)]',
          alignItems: 'stretch',
          gap: '4',
          width: 'full',
          maxWidth: '320',
          flex: '1',
          minHeight: '0',
        }}
      >
        <MatchupCard
          id={pair.aId}
          focused={focus !== undefined}
          disabled={busy}
          shortcutHint="←"
          onPick={pickLeft}
        />
        <styled.span
          css={{
            alignSelf: 'center',
            textStyle: 'sm',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            color: 'muted',
            flex: '[0 0 auto]',
          }}
        >
          vs
        </styled.span>
        <MatchupCard id={pair.bId} disabled={busy} shortcutHint="→" onPick={pickRight} />
      </styled.div>
      <styled.div css={{ display: 'flex', flexShrink: '0', gap: '3' }}>
        <Button variant="outline" disabled={busy} onClick={draw}>
          <EqualIcon />
          Draw
          <Kbd>D</Kbd>
        </Button>
        <Button variant="ghost" disabled={busy} onClick={skip}>
          <SkipForwardIcon />
          Skip
          <Kbd>S</Kbd>
        </Button>
      </styled.div>
    </>
  );
}

function MatchupCard({
  id,
  focused,
  disabled,
  shortcutHint,
  onPick,
}: {
  id: DbId;
  focused?: boolean;
  disabled: boolean;
  shortcutHint: string;
  onPick: () => void;
}) {
  return (
    <styled.section
      data-focused={focused ? true : undefined}
      css={{
        width: 'full',
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
        minWidth: '0',
        minHeight: '0',
        borderRadius: 'md',
        borderWidth: '1px',
        borderColor: 'divider',
        backgroundColor: 'surface',
        padding: '4',
        _dataFocused: { borderColor: 'accent' },
      }}
    >
      <styled.div css={{ flex: '1', minHeight: '0', overflowY: 'auto' }}>
        <RecordDisplay recordId={id} />
        <RelationsPreview
          id={id}
          css={{ marginBlockStart: '4', borderBlockStart: 'divider', paddingBlockStart: '4' }}
        />
      </styled.div>
      <styled.footer
        css={{
          display: 'flex',
          flexShrink: '0',
          alignItems: 'center',
          justifyContent: 'center',
          height: '9',
        }}
      >
        <Button variant="outline" css={{ width: 'full' }} disabled={disabled} onClick={onPick}>
          Pick
          <Kbd>{shortcutHint}</Kbd>
        </Button>
      </styled.footer>
    </styled.section>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <styled.kbd
      css={{
        borderRadius: 'sm',
        backgroundColor: 'splash',
        paddingInline: '1.5',
        fontFamily: 'mono',
        color: 'accent',
      }}
    >
      {children}
    </styled.kbd>
  );
}
