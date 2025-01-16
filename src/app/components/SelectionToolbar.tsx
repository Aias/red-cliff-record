import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, IconButton, Text, type ButtonProps } from '@radix-ui/themes';
import { IconWrapper } from './IconWrapper';

interface SelectionActionsProps {
	selectedCount: number;
	onClear: () => void;
	actions: Array<{
		label: string;
		onClick: () => void;
		disabled?: boolean;
	}>;
	buttonProps?: ButtonProps;
}

export function SelectionActions({
	selectedCount,
	onClear,
	actions,
	buttonProps = {},
}: SelectionActionsProps) {
	const { size = '2', ...rest } = buttonProps;
	return (
		<div role="toolbar" className="flex items-center gap-2">
			<Text size={size}>{selectedCount} selected</Text>
			{actions.map((action) => (
				<Button
					key={action.label}
					onClick={action.onClick}
					disabled={action.disabled}
					size={size}
					{...rest}
				>
					{action.label}
				</Button>
			))}
			<IconButton variant="soft" onClick={onClear} size={size} {...rest} title="Clear selection">
				<IconWrapper size={size}>
					<Cross1Icon />
				</IconWrapper>
			</IconButton>
		</div>
	);
}
