import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/app/lib/utils';

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-c-focus focus-visible:ring-c-focus/50 focus-visible:ring-[3px] aria-invalid:ring-c-destructive/20 dark:aria-invalid:ring-c-destructive/40 aria-invalid:border-c-destructive",
	{
		variants: {
			variant: {
				default: 'bg-c-main text-c-main-contrast shadow-xs hover:bg-c-main/90',
				destructive:
					'bg-c-destructive text-white shadow-xs hover:bg-c-destructive/90 focus-visible:ring-c-destructive/20 dark:focus-visible:ring-c-destructive/40 dark:bg-c-destructive/60',
				outline:
					'border bg-c-app shadow-xs hover:bg-c-splash hover:text-c-display dark:bg-c-border/30 dark:border-c-border dark:hover:bg-c-border/50',
				secondary: 'bg-c-splash text-c-accent shadow-xs hover:bg-c-flood',
				ghost:
					'hover:bg-c-splash hover:text-c-display dark:hover:bg-c-splash text-c-primary [&_svg]:text-c-symbol hover:[&_svg]:text-c-display',
				link: 'text-c-main underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-9 px-4 py-2 has-[>svg]:px-3',
				sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
				lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
				icon: 'size-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

export interface ButtonProps extends React.ComponentProps<'button'> {
	variant?: VariantProps<typeof buttonVariants>['variant'];
	size?: VariantProps<typeof buttonVariants>['size'];
	asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
	const Comp = asChild ? Slot.Root : 'button';

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
