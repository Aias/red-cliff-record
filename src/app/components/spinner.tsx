import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';

// An internal copy of the Radix Spinner component
// https://www.radix-ui.com/themes/docs/components/spinner

type SpinnerProps = ComponentProps<typeof styled.span>;

const Spinner = ({ css: cssProp, ...props }: SpinnerProps) => {
  // Duration of the spinner animation in seconds.
  const duration = 0.8;

  // Create 8 spinner segments (leaves).
  const leaves = Array.from({ length: 8 }).map((_, i) => {
    const rotation = i * 45;
    // Calculate the animation delay so that the first leaf starts at -duration,
    // then increments from there.
    const delay = -((8 - i) / 8) * duration;
    return (
      <styled.span
        key={i}
        css={{
          '--leaf-width': '12.5%',
          position: 'absolute',
          top: '0',
          left: '[calc(50% - var(--leaf-width) / 2)]',
          height: 'full',
          width: 'var(--leaf-width)',
          animationName: 'spinnerLeafFade',
          animationDuration: '[800ms]',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}
        style={{ transform: `rotate(${rotation}deg)`, animationDelay: `${delay}s` }}
      >
        <styled.span
          css={{
            display: 'block',
            height: '[30%]',
            width: 'full',
            borderRadius: 'sm',
            backgroundColor: 'currentColor',
          }}
        />
      </styled.span>
    );
  });

  return (
    <styled.span
      css={css.raw(
        {
          position: 'relative',
          display: 'inline-block',
          boxSize: 'em',
          color: 'currentColor',
          opacity: '0.75',
        },
        cssProp
      )}
      {...props}
    >
      {leaves}
    </styled.span>
  );
};

Spinner.displayName = 'Spinner';

export { Spinner };
