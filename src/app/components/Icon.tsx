import { Text, type TextProps } from '@radix-ui/themes';

export const IconWrapper = ({
	size = '3',
	color,
	children,
	className = '',
	style = {},
	...props
}: TextProps) => {
	return (
		<Text
			asChild
			size={size}
			color={color}
			{...props}
			className={`inline-flex ${className}`}
			style={{
				width: '1em',
				height: '1em',
				aspectRatio: '1/1',
				lineHeight: 1,
				...style,
			}}
		>
			{children}
		</Text>
	);
};
