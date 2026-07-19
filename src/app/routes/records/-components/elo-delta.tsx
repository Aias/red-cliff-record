import { styled } from '@/styled-system/jsx';

/** Signed ELO score change, colored by direction. */
export function EloDelta({ delta }: { delta: number }) {
  return (
    <styled.span
      data-delta={delta >= 0 ? 'positive' : 'negative'}
      css={{
        fontFamily: 'mono',
        fontWeight: 'medium',
        animateIn: true,
        fadeIn: 0,
        '&[data-delta=positive]': { palette: 'success', chromatic: true, color: 'accent' },
        '&[data-delta=negative]': { palette: 'error', chromatic: true, color: 'accent' },
      }}
    >
      {delta >= 0 ? `+${delta}` : delta}
    </styled.span>
  );
}
