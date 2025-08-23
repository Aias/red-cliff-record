import * as React from 'react';
import { CircleIcon } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/app/lib/utils';

function RadioGroup({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
	return (
		<RadioGroupPrimitive.Root
			data-slot="radio-group"
			className={cn('grid gap-3', className)}
			{...props}
		/>
	);
}

function RadioGroupItem({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
	return (
		<RadioGroupPrimitive.Item
			data-slot="radio-group-item"
			className={cn(
				'aspect-square size-4 shrink-0 rounded-full border border-c-border text-c-main shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-c-focus focus-visible:ring-[3px] focus-visible:ring-c-focus/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-c-destructive aria-invalid:ring-c-destructive/20 dark:bg-c-border/30 dark:aria-invalid:ring-c-destructive/40',
				className
			)}
			{...props}
		>
			<RadioGroupPrimitive.Indicator
				data-slot="radio-group-indicator"
				className="relative flex items-center justify-center"
			>
				<CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-c-main" />
			</RadioGroupPrimitive.Indicator>
		</RadioGroupPrimitive.Item>
	);
}

export { RadioGroup, RadioGroupItem };
