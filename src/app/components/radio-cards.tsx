import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

type RadioCardsProps = React.ComponentPropsWithRef<typeof RadioGroupPrimitive.Root>;

const RadioCards = ({ className, children, ...props }: RadioCardsProps) => (
	<RadioGroupPrimitive.Root className={className} {...props}>
		{children}
	</RadioGroupPrimitive.Root>
);
RadioCards.displayName = 'RadioCards';

type RadioCardsItemProps = React.ComponentPropsWithRef<typeof RadioGroupPrimitive.Item>;

const RadioCardsItem = ({ className, children, ...props }: RadioCardsItemProps) => (
	<RadioGroupPrimitive.Item
		className={cn(
			'data-[state=checked]:themed relative flex min-h-max cursor-pointer items-center justify-center rounded-md border border-input bg-background p-[0.75em] text-left text-foreground shadow-xs transition-all hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ring data-[state=checked]:bg-accent',
			className
		)}
		{...props}
	>
		{children}
	</RadioGroupPrimitive.Item>
);
RadioCardsItem.displayName = 'RadioCardsItem';

export { RadioCards, RadioCardsItem };
export type { RadioCardsProps };
