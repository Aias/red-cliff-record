import { Text, TextProps } from '@radix-ui/themes';

export const Icon = ({ size = '3', color, children, ...props }: TextProps) => {
	return (
		<Text
			asChild
			size={size}
			color={color}
			{...props}
			style={{
				display: 'inline-block',
				width: '1em',
				height: '1em',
				lineHeight: 1,
			}}
		>
			{children}
		</Text>
	);
};
