import type { RecordType } from '@hozo';
import { useZero } from '@rocicorp/zero/react';
import { useNavigate } from '@tanstack/react-router';
import { EqualIcon, PinIcon, PinOffIcon, SkipForwardIcon, Undo2Icon } from 'lucide-react';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Button } from '@/components/button';
import { Placeholder } from '@/components/placeholder';
import { Spinner } from '@/components/spinner';
import { Tooltip } from '@/components/tooltip';
import { readEloPool } from '@/lib/hooks/record-queries';
import { useZeroMutate } from '@/lib/hooks/zero-mutate';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { whenSynced } from '@/lib/sync-status';
import { eloDeltas, selectMatchup, type PoolCandidate } from '@/shared/lib/elo';
import type { DbId, UndoMatchupInput } from '@/shared/types/api';
import { mutators, type SubmitMatchupInput } from '@/shared/zero/mutators';
import { queries } from '@/shared/zero/queries';
import { styled } from '@/styled-system/jsx';
import { RecordDisplay } from '../../records/-components/record-display';
import { RelationsPreview } from '../../records/-components/relations-preview';

/** Recent focused-burst opponents excluded from reselection. */
const EXCLUDE_MEMORY = 20;

export type ArenaSide = 'left' | 'right';

export interface ArenaParams {
  type: RecordType;
  focus?: DbId;
  side?: ArenaSide;
  minScore?: number;
}

export function arenaSessionKey({ type, focus, side, minScore }: ArenaParams): string {
  return `${type}:${focus ?? 'open'}:${side ?? 'left'}:${minScore ?? 'all'}`;
}

type Pair = { aId: DbId; bId: DbId };
type Matchup = Pair | null;

/**
 * Snapshot for stepping back one action: the pair that was on screen, the
 * exclusion state it was selected under, and, when the action submitted a
 * result, the mutation that reverses it.
 */
type UndoEntry = { pair: Pair; excludeIds: DbId[]; reversal?: UndoMatchupInput };

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

export function ArenaSession({ type, focus, side, minScore }: ArenaParams) {
  const sessionKey = arenaSessionKey({ type, focus, side, minScore });
  const zero = useZero();
  const navigate = useNavigate({ from: '/arena' });
  const [pair, setPair] = useState<Matchup>(() => sessions.get(sessionKey)?.pair ?? null);
  const [loading, setLoading] = useState(() => !sessions.get(sessionKey)?.pair);
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const zeroMutate = useZeroMutate();

  const focusedLeft = focus !== undefined && side !== 'right';
  const focusedRight = focus !== undefined && side === 'right';
  const opponentOf = (current: Pair) => (focusedRight ? current.aId : current.bId);
  const nextExcludes = (current: Pair) =>
    focus !== undefined
      ? [...getSession(sessionKey).excludeIds, opponentOf(current)].slice(-EXCLUDE_MEMORY)
      : [current.aId, current.bId];

  const loadNext = (excludeIds: DbId[]) => {
    const session = getSession(sessionKey);
    session.excludeIds = excludeIds;
    const select = (pool: PoolCandidate[]) => {
      // The focused record stays eligible below the score floor so it can be
      // ranked against the filtered field from wherever it currently sits.
      const eligible =
        minScore === undefined
          ? pool
          : pool.filter((record) => record.eloScore >= minScore || record.id === focus);
      const selected = selectMatchup(eligible, { focusId: focus, excludeIds });
      return selected && focusedRight ? { aId: selected.bId, bId: selected.aId } : selected;
    };
    void (async () => {
      let next = select(await readEloPool(zero, type));
      if (!next) {
        // An empty selection before the initial preload lands means the local
        // replica hasn't hydrated, not that the pool is empty — wait for the
        // sync and re-read before concluding there is nothing to rank.
        await whenSynced();
        next = select(await readEloPool(zero, type));
      }
      session.pair = next;
      setPair(next);
    })().finally(() => setLoading(false));
  };

  const loadInitial = useEffectEvent(() => {
    if (!pair) loadNext(getSession(sessionKey).excludeIds);
  });
  useEffect(() => {
    loadInitial();
  }, []);

  const busy = loading || !pair;

  /**
   * Submit a result and advance. The deltas the mutator is about to apply are
   * recomputed here from the same local state so the undo entry can reverse
   * them exactly.
   */
  const submit = (current: Pair, input: SubmitMatchupInput) => {
    setLoading(true);
    const excludeIds = getSession(sessionKey).excludeIds;
    void (async () => {
      const [aId, bId] = 'winnerId' in input ? [input.winnerId, input.loserId] : input.drawIds;
      const [a, b, matchupsA, matchupsB] = await Promise.all([
        zero.run(queries.record({ id: aId })),
        zero.run(queries.record({ id: bId })),
        zero.run(queries.recordMatchups({ id: aId })),
        zero.run(queries.recordMatchups({ id: bId })),
      ]);
      if (a && b) {
        const { deltaA, deltaB } = eloDeltas(
          { eloScore: a.eloScore, matchupCount: matchupsA.length },
          { eloScore: b.eloScore, matchupCount: matchupsB.length },
          'winnerId' in input ? 'win' : 'draw'
        );
        void zeroMutate(mutators.elo.submitMatchup(input));
        setUndoEntry({
          pair: current,
          excludeIds,
          reversal: {
            aId,
            bId,
            winnerId: 'winnerId' in input ? input.winnerId : null,
            deltaA,
            deltaB,
          },
        });
      }
      loadNext(nextExcludes(current));
    })();
  };

  const pick = (winnerId: DbId, loserId: DbId) => {
    if (busy || !pair) return;
    submit(pair, { winnerId, loserId });
  };
  const pickLeft = () => pair && pick(pair.aId, pair.bId);
  const pickRight = () => pair && pick(pair.bId, pair.aId);
  const draw = () => {
    if (busy || !pair) return;
    submit(pair, { drawIds: [pair.aId, pair.bId] });
  };
  const skip = () => {
    if (busy || !pair) return;
    setUndoEntry({ pair, excludeIds: getSession(sessionKey).excludeIds });
    setLoading(true);
    loadNext(nextExcludes(pair));
  };

  const undo = () => {
    if (loading || !undoEntry) return;
    if (undoEntry.reversal) void zeroMutate(mutators.elo.undoMatchup(undoEntry.reversal));
    const session = getSession(sessionKey);
    session.pair = undoEntry.pair;
    session.excludeIds = undoEntry.excludeIds;
    setPair(undoEntry.pair);
    setUndoEntry(null);
  };

  /**
   * Pin a record to its current side, or unpin it when it is already the
   * focus. The upcoming session is seeded with the on-screen pair so the
   * matchup carries over instead of re-rolling.
   */
  const pin = (target: ArenaSide) => {
    if (busy || !pair) return;
    const id = target === 'left' ? pair.aId : pair.bId;
    if (id === focus) {
      sessions.set(arenaSessionKey({ type, minScore }), { pair, excludeIds: [] });
      void navigate({
        search: (prev) => ({ type: prev.type, minScore: prev.minScore }),
      });
    } else {
      sessions.set(arenaSessionKey({ type, focus: id, side: target, minScore }), {
        pair,
        excludeIds: [],
      });
      void navigate({ search: (prev) => ({ ...prev, focus: id, side: target }) });
    }
  };
  const pinLeft = () => pin('left');
  const pinRight = () => pin('right');

  useKeyboardShortcut('arrowleft', pickLeft, {
    description: 'Pick the left record',
    category: 'Arena',
  });
  useKeyboardShortcut('arrowright', pickRight, {
    description: 'Pick the right record',
    category: 'Arena',
  });
  useKeyboardShortcut('shift+arrowleft', pinLeft, {
    description: 'Pin or unpin the left record',
    category: 'Arena',
  });
  useKeyboardShortcut('shift+arrowright', pinRight, {
    description: 'Pin or unpin the right record',
    category: 'Arena',
  });
  useKeyboardShortcut('d', draw, { description: 'Declare a draw', category: 'Arena' });
  useKeyboardShortcut('s', skip, { description: 'Skip the matchup', category: 'Arena' });
  useKeyboardShortcut('u', undo, { description: 'Undo the last matchup', category: 'Arena' });

  if (!pair) {
    return (
      <Placeholder css={{ flexGrow: '1' }}>
        {loading ? (
          <Spinner />
        ) : minScore !== undefined ? (
          'Not enough records above this score.'
        ) : (
          'Not enough curated records to rank.'
        )}
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
          type={type}
          focused={focusedLeft}
          disabled={busy}
          shortcutHint="←"
          pinHint="⇧←"
          onPick={pickLeft}
          onPin={pinLeft}
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
        <MatchupCard
          id={pair.bId}
          type={type}
          focused={focusedRight}
          disabled={busy}
          shortcutHint="→"
          pinHint="⇧→"
          onPick={pickRight}
          onPin={pinRight}
        />
      </styled.div>
      <styled.div css={{ display: 'flex', flexShrink: '0', gap: '3' }}>
        <Button variant="ghost" disabled={busy || !undoEntry} onClick={undo}>
          <Undo2Icon />
          Undo
          <Kbd>U</Kbd>
        </Button>
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
  type,
  focused,
  disabled,
  shortcutHint,
  pinHint,
  onPick,
  onPin,
}: {
  id: DbId;
  type: RecordType;
  focused: boolean;
  disabled: boolean;
  shortcutHint: string;
  pinHint: string;
  onPick: () => void;
  onPin: () => void;
}) {
  return (
    <styled.section
      data-focused={focused ? true : undefined}
      data-type={type}
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
        '&[data-focused][data-type=artifact]': { palette: 'artifact' },
        '&[data-focused][data-type=concept]': { palette: 'concept' },
        '&[data-focused][data-type=entity]': { palette: 'entity' },
        _dataFocused: { chromatic: true, borderColor: 'accent' },
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
          gap: '2',
          height: '9',
        }}
      >
        <Button variant="outline" css={{ flex: '1' }} disabled={disabled} onClick={onPick}>
          Pick
          <Kbd>{shortcutHint}</Kbd>
        </Button>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={focused ? 'Unpin this record' : 'Pin this record to this side'}
                disabled={disabled}
                onClick={onPin}
              >
                {focused ? <PinOffIcon /> : <PinIcon />}
              </Button>
            }
          />
          <Tooltip.Content>
            {focused ? 'Unpin this record' : 'Pin this record to this side'} ({pinHint})
          </Tooltip.Content>
        </Tooltip.Root>
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
