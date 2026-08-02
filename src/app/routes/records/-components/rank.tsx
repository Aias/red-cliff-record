import { useZero } from '@rocicorp/zero/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CrosshairIcon,
  RefreshCwIcon,
  SkipForwardIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from 'lucide-react';
import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useTRPC } from '@/app/trpc';
import { Button } from '@/components/button';
import { Spinner } from '@/components/spinner';
import { Tooltip } from '@/components/tooltip';
import { createLocalStorageStore } from '@/lib/create-local-storage-store';
import { useMatchupCount, useRecord } from '@/lib/hooks/record-queries';
import { useZeroMutate } from '@/lib/hooks/zero-mutate';
import { eloDeltas } from '@/shared/lib/elo';
import type { DbId } from '@/shared/types/api';
import { mutators } from '@/shared/zero/mutators';
import { queries } from '@/shared/zero/queries';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { EloDelta } from './elo-delta';
import { RecordLink } from './record-link';

const OPPONENT_COUNT = 3;
/** How long the score delta stays up before the resolved opponent is replaced. */
const REVEAL_MS = 1200;

const collapsedStore = createLocalStorageStore<boolean>({
  key: 'rcr:rank-collapsed',
  defaultValue: false,
  parse: (raw) => raw === 'true',
});

interface Reveal {
  opponentId: DbId;
  focusDelta: number;
  opponentDelta: number;
}

export const RankSection = ({ id }: { id: DbId }) => {
  const { data: record } = useRecord(id);
  const matchupCount = useMatchupCount(id);
  const collapsed = useSyncExternalStore(
    collapsedStore.subscribe,
    collapsedStore.getSnapshot,
    collapsedStore.getServerSnapshot
  );
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const zero = useZero();
  const zeroMutate = useZeroMutate();
  const [submitting, setSubmitting] = useState(false);

  // Only root-level artifacts are rankable: one contained by a parent record
  // (a highlight, an excerpt) is ranked through that parent. Citation links
  // like quotes don't demote a record, and concepts/entities always stand alone.
  const isChildArtifact =
    record?.type === 'artifact' &&
    (record.outgoingLinks?.some((link) => link.predicate === 'contained_by') ?? false);
  const eligible = record?.isCurated === true && !isChildArtifact;
  const opponents = useQuery(
    trpc.elo.getOpponents.queryOptions(
      { recordId: id, count: OPPONENT_COUNT },
      {
        enabled: eligible && !collapsed,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Random roll: auto-invalidation would re-roll opponents on every mutation.
        meta: { invalidation: 'manual' },
      }
    )
  );

  // Slots override the query result so a resolved opponent can be swapped out
  // without re-rolling the other rows; `seen` keeps replacements fresh.
  const [slots, setSlots] = useState<DbId[] | null>(null);
  const [seen, setSeen] = useState<DbId[]>([]);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const displayed = slots ?? opponents.data?.opponentIds ?? [];

  const replaceOpponent = (opponentId: DbId) => {
    const excluded = [...new Set([...seen, ...displayed])];
    setSeen(excluded);
    void queryClient
      .fetchQuery(
        trpc.elo.getOpponents.queryOptions({ recordId: id, count: 1, excludeIds: excluded })
      )
      .then(({ opponentIds }) => {
        const next = opponentIds[0];
        setSlots((prev) => {
          const base = prev ?? opponents.data?.opponentIds ?? [];
          return next
            ? base.map((o) => (o === opponentId ? next : o))
            : base.filter((o) => o !== opponentId);
        });
      });
  };

  const refresh = () => {
    if (reveal) return;
    const excluded = [...new Set([...seen, ...displayed])];
    setSeen(excluded);
    void queryClient
      .fetchQuery(
        trpc.elo.getOpponents.queryOptions({
          recordId: id,
          count: OPPONENT_COUNT,
          excludeIds: excluded,
        })
      )
      .then(({ opponentIds }) => {
        if (opponentIds.length > 0) {
          setSlots(opponentIds);
        } else {
          // Pool exhausted: forget history and start over
          setSeen([]);
          setSlots(null);
        }
      });
  };

  const fight = (opponentId: DbId, focusWins: boolean) => {
    if (reveal || submitting) return;
    const [winnerId, loserId] = focusWins ? [id, opponentId] : [opponentId, id];
    setSubmitting(true);
    void (async () => {
      try {
        // Read pre-matchup scores so the reveal deltas match what the mutator
        // computes inside its transaction.
        const [focus, opponent, focusMatchups, opponentMatchups] = await Promise.all([
          zero.run(queries.record({ id })),
          zero.run(queries.record({ id: opponentId })),
          zero.run(queries.recordMatchups({ id })),
          zero.run(queries.recordMatchups({ id: opponentId })),
        ]);
        if (!focus || !opponent) return;
        const [winner, winnerMatchups, loser, loserMatchups] = focusWins
          ? [focus, focusMatchups, opponent, opponentMatchups]
          : [opponent, opponentMatchups, focus, focusMatchups];
        const { deltaA: winnerDelta, deltaB: loserDelta } = eloDeltas(
          { eloScore: winner.eloScore, matchupCount: winnerMatchups.length },
          { eloScore: loser.eloScore, matchupCount: loserMatchups.length },
          'win'
        );
        await zeroMutate(mutators.elo.submitMatchup({ winnerId, loserId }));
        setReveal({
          opponentId,
          focusDelta: focusWins ? winnerDelta : loserDelta,
          opponentDelta: focusWins ? loserDelta : winnerDelta,
        });
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const onRevealTimeout = useEffectEvent(() => {
    if (!reveal) return;
    setReveal(null);
    replaceOpponent(reveal.opponentId);
  });
  useEffect(() => {
    if (!reveal) return;
    const timer = window.setTimeout(onRevealTimeout, REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [reveal]);

  const toggleCollapsed = () => {
    collapsedStore.set(!collapsed);
  };

  if (!record || !eligible) return null;

  const CollapseIcon = collapsed ? ChevronRightIcon : ChevronDownIcon;

  return (
    <styled.section css={{ textStyle: 'xs' }}>
      <styled.header css={{ display: 'flex', alignItems: 'center', gap: '1', marginBlockEnd: '2' }}>
        <styled.h3 css={{ flex: '1' }}>Rank</styled.h3>
        {!collapsed && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="New opponents"
                  disabled={reveal !== null}
                  onClick={refresh}
                >
                  <RefreshCwIcon />
                </Button>
              }
            />
            <Tooltip.Content>New opponents</Tooltip.Content>
          </Tooltip.Root>
        )}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rank this record in the arena"
                render={<Link to="/arena" search={{ type: record.type, focus: id }} />}
              >
                <CrosshairIcon />
              </Button>
            }
          />
          <Tooltip.Content>Rank this record in the arena</Tooltip.Content>
        </Tooltip.Root>
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Expand rank section' : 'Collapse rank section'}
          onClick={toggleCollapsed}
        >
          <CollapseIcon />
        </Button>
      </styled.header>
      {!collapsed && (
        <>
          <styled.p
            css={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '1.5',
              marginBlockEnd: '2',
              fontFamily: 'mono',
              color: 'secondary',
            }}
          >
            <styled.span css={{ fontWeight: 'semibold', color: 'primary' }}>
              {record.eloScore}
            </styled.span>
            {reveal && <EloDelta delta={reveal.focusDelta} />}
            <span>· {matchupCount} matchups</span>
          </styled.p>
          {opponents.isLoading ? (
            <Spinner />
          ) : displayed.length > 0 ? (
            <ul>
              {displayed.map((opponentId) => (
                <OpponentRow
                  key={opponentId}
                  opponentId={opponentId}
                  busy={reveal !== null || submitting}
                  revealDelta={reveal?.opponentId === opponentId ? reveal.opponentDelta : undefined}
                  onFight={fight}
                  onSkip={replaceOpponent}
                />
              ))}
            </ul>
          ) : (
            <p>No opponents available.</p>
          )}
        </>
      )}
    </styled.section>
  );
};

function OpponentRow({
  opponentId,
  busy,
  revealDelta,
  onFight,
  onSkip,
}: {
  opponentId: DbId;
  busy: boolean;
  revealDelta?: number;
  onFight: (opponentId: DbId, focusWins: boolean) => void;
  onSkip: (opponentId: DbId) => void;
}) {
  const handleWin = () => onFight(opponentId, true);
  const handleLoss = () => onFight(opponentId, false);
  const handleSkip = () => onSkip(opponentId);

  return (
    <styled.li css={{ display: 'flex', alignItems: 'center', gap: '2', marginBlockEnd: '2' }}>
      <styled.span css={{ display: 'flex', flexShrink: '0', _childIcon: { boxSize: '3.5' } }}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="This record wins"
          disabled={busy}
          onClick={handleWin}
        >
          <ThumbsUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Opponent wins"
          disabled={busy}
          onClick={handleLoss}
        >
          <ThumbsDownIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Skip opponent"
          disabled={busy}
          onClick={handleSkip}
        >
          <SkipForwardIcon />
        </Button>
      </styled.span>
      <RecordLink
        id={opponentId}
        className={css({ flex: '1', minWidth: '0' })}
        linkOptions={{ to: '/records/$recordId', params: { recordId: opponentId } }}
      />
      {revealDelta !== undefined && <EloDelta delta={revealDelta} />}
    </styled.li>
  );
}
