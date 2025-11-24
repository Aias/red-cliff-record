import { type ComponentProps } from 'react';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const Checkbox = ({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) => (
	<CheckboxPrimitive.Root className={cn('peer checkbox shrink-0', className)} {...props}>
		<CheckboxPrimitive.Indicator
			className={cn(
				'relative flex size-full items-center justify-center overflow-hidden text-current'
			)}
		>
			<CheckIcon className="absolute inset-1/2 size-[1.15em] -translate-x-1/2 -translate-y-[calc(50%+0.025em)]" />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
);
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
