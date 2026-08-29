import { Slider as BaseSlider } from '@base-ui/react/slider';
import type { RecordType } from '@hozo';
import { useState } from 'react';
import { useEloScores } from '@/lib/hooks/record-queries';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { SystemStyleObject } from '@/styled-system/types';

/** Width of one histogram bucket, in Elo points. */
const BUCKET_WIDTH = 25;

/**
 * Crossfilter-style score-floor control: a histogram of the rankable pool's
 * Elo distribution with a scrubbable cutoff. Bars at or above the cutoff are
 * lit; scrubbing to the left edge clears the floor entirely. The floor
 * commits on release so the session only re-rolls once per adjustment.
 */
export function EloScrubber({
  type,
  minScore,
  onMinScoreChange,
  css: cssProp,
}: {
  type: RecordType;
  minScore?: number;
  onMinScoreChange: (minScore: number | undefined) => void;
  css?: SystemStyleObject;
}) {
  const scores = useEloScores(type);
  // Live scrub position; cleared when the committed floor lands from the URL.
  const [scrub, setScrub] = useState<number | null>(null);
  const [prevMinScore, setPrevMinScore] = useState(minScore);
  if (prevMinScore !== minScore) {
    setPrevMinScore(minScore);
    setScrub(null);
  }

  if (scores.length === 0) return null;

  const domainStart = Math.floor(Math.min(...scores) / BUCKET_WIDTH) * BUCKET_WIDTH;
  const domainEnd = (Math.floor(Math.max(...scores) / BUCKET_WIDTH) + 1) * BUCKET_WIDTH;
  const buckets: number[] = Array.from(
    { length: (domainEnd - domainStart) / BUCKET_WIDTH },
    () => 0
  );
  for (const score of scores) {
    const index = Math.floor((score - domainStart) / BUCKET_WIDTH);
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  const maxCount = Math.max(...buckets);

  const floor = Math.min(Math.max(scrub ?? minScore ?? domainStart, domainStart), domainEnd);
  const included = scores.filter((score) => score >= floor).length;

  const handleValueChange = (value: number) => setScrub(value);
  const handleValueCommitted = (value: number) =>
    onMinScoreChange(value <= domainStart ? undefined : value);

  return (
    <BaseSlider.Root
      value={floor}
      min={domainStart}
      max={domainEnd}
      step={BUCKET_WIDTH}
      largeStep={BUCKET_WIDTH * 4}
      onValueChange={handleValueChange}
      onValueCommitted={handleValueCommitted}
      data-type={type}
      render={
        <styled.div
          css={css.raw(
            {
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              width: 'full',
              maxWidth: '160',
              userSelect: 'none',
              chromatic: false,
              '&[data-type=artifact]': { palette: 'artifact' },
              '&[data-type=concept]': { palette: 'concept' },
              '&[data-type=entity]': { palette: 'entity' },
            },
            cssProp
          )}
        />
      }
    >
      <BaseSlider.Control
        render={
          <styled.div
            css={{
              position: 'relative',
              display: 'flex',
              width: 'full',
              height: '12',
              cursor: 'ew-resize',
              touchAction: 'none',
            }}
          />
        }
      >
        <BaseSlider.Track
          render={<styled.div css={{ position: 'relative', width: 'full', height: 'full' }} />}
        >
          <styled.div
            css={{
              position: 'absolute',
              inset: '0',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '0.5',
              pointerEvents: 'none',
            }}
          >
            {buckets.map((count, index) => {
              const bucketStart = domainStart + index * BUCKET_WIDTH;
              const height = count === 0 ? 0 : Math.max((count / maxCount) * 100, 5);
              return (
                <styled.div
                  key={bucketStart}
                  data-included={bucketStart >= floor ? true : undefined}
                  css={{
                    flex: '1',
                    minWidth: '0',
                    borderStartStartRadius: 'sm',
                    borderStartEndRadius: 'sm',
                    backgroundColor: 'flood',
                    transitionProperty: '[background-color]',
                    transitionDuration: '100',
                    transitionTimingFunction: 'easeOut.quad',
                    '&[data-included]': { backgroundColor: 'main' },
                  }}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </styled.div>
          <BaseSlider.Thumb
            aria-label="Score floor"
            render={
              <styled.div
                css={{
                  height: 'full',
                  width: '1',
                  borderRadius: 'full',
                  chromatic: true,
                  backgroundColor: 'accentActive',
                  outline: 'none',
                  _focusVisible: {
                    outlineColor: 'focus/50',
                    outlineOffset: '0.5',
                    outlineStyle: 'solid',
                    outlineWidth: '2px',
                  },
                }}
              />
            }
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
      <styled.div
        css={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '2',
          textStyle: 'xs',
          color: 'muted',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{domainStart}</span>
        <styled.span css={{ color: 'secondary' }}>
          {floor > domainStart
            ? `${floor}+ · ${included} of ${scores.length} records`
            : `Any score · ${scores.length} records`}
        </styled.span>
        <span>{domainEnd}</span>
      </styled.div>
    </BaseSlider.Root>
  );
}
