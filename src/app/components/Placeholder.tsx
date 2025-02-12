import { Box } from '@radix-ui/themes';

export const Placeholder = ({
	children,
	className = '',
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return (
		<Box
			className={`flex h-full shrink-0 grow flex-col items-center justify-center gap-2 rounded-2 border border-divider bg-tint p-4 ${className}`}
		>
			{children}
		</Box>
	);
};
