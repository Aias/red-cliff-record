import { Popover as PopoverPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/app/lib/utils';
import { css } from '@/styled-system/css';

export type PopoverProps = React.ComponentProps<typeof PopoverPrimitive.Root>;

function Popover({ ...props }: PopoverProps) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export type PopoverTriggerProps = React.ComponentProps<typeof PopoverPrimitive.Trigger>;

function PopoverTrigger({ ...props }: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Content>;

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  collisionPadding = 16,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-c-float p-4 text-c-primary shadow-md outline-hidden',
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
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
