import { type ComponentProps } from 'react';
import { Checkbox, Flex, Text } from '@radix-ui/themes';

type CheckboxWithLabelProps = Omit<ComponentProps<typeof Checkbox>, 'size'> & {
	label: string;
	size?: '1' | '2' | '3';
	className?: string;
};

export const CheckboxWithLabel = ({
	label,
	size = '2',
	className,
	...checkboxProps
}: CheckboxWithLabelProps) => {
	return (
		<label className={className}>
			<Flex gap={size === '1' ? '1' : '2'} align="center">
				<Checkbox size={size} {...checkboxProps} />
				<Text size={size} weight="medium">
					{label}
				</Text>
			</Flex>
		</label>
	);
};
