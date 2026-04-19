import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/app/lib/utils';
import { css } from '@/styled-system/css';

export type HoverCardProps = React.ComponentProps<typeof HoverCardPrimitive.Root>;

function HoverCard({ ...props }: HoverCardProps) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

export type HoverCardTriggerProps = React.ComponentProps<typeof HoverCardPrimitive.Trigger>;

function HoverCardTrigger({ ...props }: HoverCardTriggerProps) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

export type HoverCardContentProps = React.ComponentProps<typeof HoverCardPrimitive.Content>;

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: HoverCardContentProps) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border bg-c-float p-4 text-c-primary shadow-md outline-hidden',
          css({
            _open: { animateIn: true, fadeIn: 0, zoomIn: 0.95 },
            _closed: { animateOut: true, fadeOut: 0, zoomOut: 0.95 },
            '&[data-side=bottom]': { slideInY: '-0.5rem' },
            '&[data-side=top]': { slideInY: '0.5rem' },
            '&[data-side=left]': { slideInX: '-0.5rem' },
            '&[data-side=right]': { slideInX: '0.5rem' },
          }),
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
