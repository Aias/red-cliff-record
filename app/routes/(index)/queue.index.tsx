import { Box, Text } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(index)/queue/')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Box className="flex flex-col gap-2 h-full grow justify-center items-center p-4 bg-gray-a2 rounded-2 border border-gray-a4">
			<Text>Select an index entry to edit.</Text>
		</Box>
	);
}
