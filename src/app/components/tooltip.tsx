import { Tooltip as TooltipPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/app/lib/utils';
import { css } from '@/styled-system/css';

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit max-w-[50vw] origin-(--radix-tooltip-content-transform-origin) rounded-md bg-c-primary px-3 py-1.5 text-xs text-c-main-contrast dark:border dark:border-c-border dark:bg-c-float dark:text-c-primary',
          css({
            animateIn: true,
            fadeIn: 0,
            zoomIn: 0.95,
            _closed: { animateOut: true, fadeOut: 0, zoomOut: 0.95 },
            '&[data-side=bottom]': { slideInY: '-0.5rem' },
            '&[data-side=top]': { slideInY: '0.5rem' },
            '&[data-side=left]': { slideInX: '-0.5rem' },
            '&[data-side=right]': { slideInX: '0.5rem' },
          }),
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%)] rotate-45 rounded-sm bg-c-primary fill-c-primary dark:border-r dark:border-b dark:border-c-border dark:bg-c-float dark:fill-c-float" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
