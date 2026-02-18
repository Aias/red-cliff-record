import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/app/lib/utils';

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
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border bg-c-float p-4 text-c-primary shadow-md outline-hidden',
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
