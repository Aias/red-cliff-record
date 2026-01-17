import * as React from 'react';
import { cn } from '@/lib/utils';

// An internal copy of the Radix Spinner component
// https://www.radix-ui.com/themes/docs/components/spinner

type SpinnerProps = React.ComponentPropsWithRef<'span'>;

const Spinner = React.memo(({ className = '', ...props }: SpinnerProps) => {
  // Duration of the spinner animation in seconds.
  const duration = 0.8;

  // Create 8 spinner segments (leaves).
  const leaves = Array.from({ length: 8 }).map((_, i) => {
    const rotation = i * 45;
    // Calculate the animation delay so that the first leaf starts at -duration,
    // then increments from there.
    const delay = -((8 - i) / 8) * duration;
    return (
      <span
        key={i}
        className="absolute top-0 left-[calc(50%-12.5%/2)] h-full w-[12.5%] animate-[spinnerLeafFade_0.8s_linear_infinite]"
        style={{
          transform: `rotate(${rotation}deg)`,
          animationDelay: `${delay}s`,
        }}
      >
        <span className="block h-[30%] w-full rounded bg-current" />
      </span>
    );
  });

  return (
    <span
      {...props}
      className={cn('relative inline-block size-[1em] text-current opacity-75', className)}
    >
      {leaves}
    </span>
  );
});

Spinner.displayName = 'Spinner';

export { Spinner };
