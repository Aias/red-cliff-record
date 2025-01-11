import { Box } from '@radix-ui/themes';

export const Placeholder = ({ children }: { children: React.ReactNode }) => {
	return (
		<Box className="flex h-full grow flex-col items-center justify-center gap-2 rounded-2 border border-divider bg-tint p-4">
			{children}
		</Box>
	);
};
