import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cva, type VariantProps } from 'class-variance-authority';
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
			'relative flex min-h-max cursor-pointer items-center justify-center rounded-md border border-input bg-card p-[0.75em] text-left text-c-primary shadow-sm transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary',
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
