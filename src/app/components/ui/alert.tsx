import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';

const alertVariants = cva(
	'relative w-full rounded-md border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-c-symbol',
	{
		variants: {
			variant: {
				default: 'bg-c-component text-c-primary border-c-border',
				destructive:
					'bg-destructive/10 text-destructive border-destructive/20 [&>svg]:text-destructive',
				success:
					'bg-c-theme-splash text-c-theme-primary border-c-theme-border [&>svg]:text-c-theme-accent',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-title"
			className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
				className
			)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
