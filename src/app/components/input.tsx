import * as React from 'react';
import { cn } from '@/app/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'flex h-9 w-full min-w-0 rounded-md border border-c-border bg-transparent px-3 py-1 text-base text-c-display shadow-xs transition-[color,box-shadow] outline-none selection:bg-c-main selection:text-c-main-contrast file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-c-primary placeholder:text-c-hint disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-c-border/30',
				'focus-visible:border-c-focus focus-visible:ring-[3px] focus-visible:ring-c-focus/50',
				'aria-invalid:border-c-destructive aria-invalid:ring-c-destructive/20 dark:aria-invalid:ring-c-destructive/40',
				className
			)}
			{...props}
		/>
	);
}

export { Input };
