import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/app/lib/utils';

const toggleVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-c-mist hover:text-c-secondary disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-c-splash text-c-secondary data-[state=on]:text-c-accent [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-c-focus focus-visible:ring-c-focus/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-c-destructive/20 dark:aria-invalid:ring-c-destructive/40 aria-invalid:border-c-destructive whitespace-nowrap",
	{
		variants: {
			variant: {
				default: 'bg-transparent',
				outline:
					'border border-c-border bg-transparent shadow-xs hover:bg-c-mist hover:text-c-display',
			},
			size: {
				default: 'h-9 px-2 min-w-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

function Toggle({
	className,
	variant,
	size,
	...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
	return (
		<TogglePrimitive.Root
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Toggle, toggleVariants };
