import { type ComponentProps } from 'react';
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from './icons';
import { cn } from '~/lib/utils';

const Checkbox = React.forwardRef<
	React.ComponentRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root ref={ref} className={cn('peer checkbox', className)} {...props}>
		<CheckboxPrimitive.Indicator
			className={cn('flex size-full items-center justify-center text-current')}
		>
			<CheckIcon className="size-[1.15em]" />
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
