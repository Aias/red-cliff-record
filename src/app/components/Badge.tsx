import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * The badgeVariants uses relative units (em) so that the padding and border-radius
 * scale with the font-size (which you can control with Tailwind’s text-[size] utilities).
 *
 * The four variants correspond to the Radix badge variants. Compound variants are used
 * to adjust the high-contrast settings based on the `highContrast` prop.
 */
const badgeVariants = cva(
	'inline-flex items-center whitespace-nowrap font-medium flex-shrink-0 transition-colors text-[0.875em] ' +
		// Use relative units here: 0.75em horizontal padding and 0.375em vertical padding, with a small rounding.
		'px-[0.75em] py-[0.25em] rounded-[0.25em]',
	{
		variants: {
			variant: {
				solid:
					'bg-rcr-main text-rcr-main-contrast ' +
					'selection:bg-rcr-hint selection:text-rcr-display',
				soft: 'bg-rcr-stain text-rcr-secondary',
				outline: 'border border-rcr-border text-rcr-secondary',
			},
		},
		defaultVariants: {
			variant: 'soft',
		},
	}
);

export interface BadgeProps
	extends React.ComponentPropsWithoutRef<'span'>,
		VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, variant, ...props }, ref) => {
		return <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
	}
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
