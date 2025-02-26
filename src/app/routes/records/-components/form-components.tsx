import { Label, Switch } from '@/components';
import { cn } from '@/lib/utils';

interface BooleanSwitchProps extends React.ComponentProps<typeof Label> {
	label: string;
	value: boolean | undefined;
	handleChange: (value: boolean) => void;
}

export const BooleanSwitch = ({
	label,
	value,
	handleChange,
	className,
	...props
}: BooleanSwitchProps) => {
	return (
		<Label className={cn('inline-flex items-center gap-3', className)} {...props}>
			<Switch checked={value} onCheckedChange={handleChange} />
			<span>{label}</span>
		</Label>
	);
};
