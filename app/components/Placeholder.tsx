import { Box } from '@radix-ui/themes';

export const Placeholder = ({ children }: { children: React.ReactNode }) => {
	return (
		<Box className="flex flex-col gap-2 h-full grow justify-center items-center p-4 bg-tint rounded-2 border border-divider">
			{children}
		</Box>
	);
};
