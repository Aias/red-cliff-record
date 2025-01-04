import { Checkbox, Flex, Text, type TextProps } from '@radix-ui/themes';
import { ComponentProps } from 'react';

type CheckboxWithLabelProps = {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	size?: '1' | '2' | '3';
} & ComponentProps<'label'>;

export const CheckboxWithLabel = ({
	label,
	checked,
	onChange,
	size = '2',
	...textProps
}: CheckboxWithLabelProps) => {
	return (
		<label {...textProps}>
			<Flex gap={size === '1' ? '1' : '2'} align="center">
				<Checkbox size={size} checked={checked} onCheckedChange={onChange} />
				<Text size={size} weight="medium">
					{label}
				</Text>
			</Flex>
		</label>
	);
};
