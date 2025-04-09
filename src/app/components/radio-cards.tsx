import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// --- Context for Size ---
type RadioCardsContextValue = {
	size?: RadioCardsVariantProps['size'];
};

const RadioCardsContext = React.createContext<RadioCardsContextValue>({});

const useRadioCardsContext = () => {
	const context = React.useContext(RadioCardsContext);
	if (!context) {
		throw new Error('useRadioCardsContext must be used within a <RadioCards /> component');
	}
	return context;
};

// --- RadioCards (Root) ---

// Base class includes grid display. User controls columns and gap via className.
const radioCardsVariants = cva('grid', {
	variants: {},
	defaultVariants: {},
});

type RadioCardsVariantProps = VariantProps<typeof radioCardsItemVariants>;

interface RadioCardsProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
	size?: RadioCardsVariantProps['size'];
}

const RadioCards = React.forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Root>,
	RadioCardsProps
>(({ className, size = 'md', children, ...props }, ref) => {
	// Memoize context value
	const contextValue = React.useMemo(() => ({ size }), [size]);

	return (
		<RadioCardsContext.Provider value={contextValue}>
			<RadioGroupPrimitive.Root
				ref={ref}
				// Apply base grid styles and allow overriding via className
				className={cn(radioCardsVariants(), className)}
				{...props}
			>
				{children}
			</RadioGroupPrimitive.Root>
		</RadioCardsContext.Provider>
	);
});
RadioCards.displayName = 'RadioCards';

// --- RadioCardsItem ---

const radioCardsItemVariants = cva(
	// Base styles: card-like appearance with interactive states
	'relative flex cursor-pointer flex-col items-center justify-center rounded-md border border-input bg-card p-4 text-c-primary shadow-sm transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary',
	{
		variants: {
			// Size variants adjust padding and text size
			size: {
				xs: 'p-1.5 text-xs',
				sm: 'p-2 text-sm',
				md: 'p-3 text-base',
				lg: 'p-4 text-lg',
			},
		},
		defaultVariants: {
			size: 'md', // Default size is medium
		},
	}
);

const RadioCardsItem = React.forwardRef<
	React.ComponentRef<typeof RadioGroupPrimitive.Item>,
	// Use the extended type directly
	React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => {
	// Consume size from context
	const { size } = useRadioCardsContext();

	return (
		<RadioGroupPrimitive.Item
			ref={ref}
			// Apply size variant from context and allow overriding via className
			className={cn(radioCardsItemVariants({ size }), className)}
			{...props}
		>
			{/* Ensure content aligns correctly within the flex container */}
			<div className="flex h-full w-full flex-col items-center justify-center">{children}</div>
		</RadioGroupPrimitive.Item>
	);
});
RadioCardsItem.displayName = 'RadioCardsItem';

export { RadioCards, RadioCardsItem };
export type { RadioCardsProps };
