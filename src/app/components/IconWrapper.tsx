import { Text, type TextProps } from '@radix-ui/themes';

export const IconWrapper = ({
	size = '3',
	color,
	children,
	className = '',
	...props
}: TextProps) => {
	return (
		<Text
			asChild
			size={size}
			color={color}
			{...props}
			className={`inline-flex aspect-square h-[1em] w-[1em] leading-none ${className}`}
		>
			{children}
		</Text>
	);
};
