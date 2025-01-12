import { Text, type TextProps } from '@radix-ui/themes';

export const Icon = ({ size = '3', color, children, className = '', ...props }: TextProps) => {
	return (
		<Text
			asChild
			size={size}
			color={color}
			{...props}
			className={`inline-block ${className}`}
			style={{
				width: '1em',
				height: '1em',
				lineHeight: 1,
			}}
		>
			{children}
		</Text>
	);
};
