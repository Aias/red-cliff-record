import { Heading } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return (
		<main className="flex basis-full flex-col gap-4 overflow-hidden p-3">
			<Heading size="5">Integrations</Heading>
			<div className="flex grow-0 basis-full flex-col gap-5 overflow-y-auto">
				Under construction.
			</div>
		</main>
	);
}
