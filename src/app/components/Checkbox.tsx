import { type ComponentProps } from 'react';
import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';
import { cn } from '~/lib/utils';

const Checkbox = React.forwardRef<
	React.ComponentRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root ref={ref} className={cn('peer checkbox', className)} {...props}>
		<CheckboxPrimitive.Indicator
			className={cn(
				'relative flex size-full items-center justify-center overflow-hidden text-current'
			)}
		>
			<CheckIcon className="absolute inset-1/2 size-[1.15em] -translate-x-1/2 -translate-y-[calc(50%+0.025em)]" />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

type CheckboxWithLabelProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, 'size'> & {
	label: string;
	className?: string;
};

export const CheckboxWithLabel = ({
	label,
	className,
	...checkboxProps
}: CheckboxWithLabelProps) => {
	return (
		<label className={cn('inline-flex items-center gap-[0.5em]', className)}>
			<Checkbox {...checkboxProps} />
			<span className="font-medium">{label}</span>
		</label>
	);
};
