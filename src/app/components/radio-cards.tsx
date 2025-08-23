import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const radioCardsVariants = cva('grid', {
	variants: {
		size: {
			xs: 'text-xs',
			sm: 'text-sm',
			md: 'text-base',
			lg: 'text-lg',
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

type RadioCardsVariantProps = VariantProps<typeof radioCardsVariants>;

interface RadioCardsProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
	size?: RadioCardsVariantProps['size'];
}

const RadioCards = React.forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Root>,
	RadioCardsProps
>(({ className, size = 'md', children, ...props }, ref) => (
	<RadioGroupPrimitive.Root
		ref={ref}
		className={cn(radioCardsVariants({ size }), className)}
		{...props}
	>
		{children}
	</RadioGroupPrimitive.Root>
));
RadioCards.displayName = 'RadioCards';

const RadioCardsItem = React.forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
	<RadioGroupPrimitive.Item
		ref={ref}
		className={cn(
			'relative flex min-h-max cursor-pointer items-center justify-center rounded-md border border-c-border bg-c-panel p-[0.75em] text-left text-c-primary shadow-sm transition-all hover:bg-c-splash hover:text-c-display focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-c-main data-[state=checked]:ring-1 data-[state=checked]:ring-c-main',
			className
		)}
		{...props}
	>
		{children}
	</RadioGroupPrimitive.Item>
));
RadioCardsItem.displayName = 'RadioCardsItem';

export { RadioCards, RadioCardsItem };
export type { RadioCardsProps };
