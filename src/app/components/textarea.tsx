import * as React from 'react';
import { cn } from '@/app/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'aria-invalid:border-c-destructive aria-invalid:ring-c-destructive/20 dark:aria-invalid:ring-c-destructive/40 flex field-sizing-content min-h-16 w-full rounded-md border border-c-border bg-transparent px-3 py-2 text-sm text-c-display shadow-xs transition-[color,box-shadow] outline-none placeholder:text-c-hint focus-visible:border-c-ring focus-visible:ring-[3px] focus-visible:ring-c-ring/50 disabled:cursor-not-allowed disabled:opacity-50', // TODO: CLR-DESTRUCTIVE
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
