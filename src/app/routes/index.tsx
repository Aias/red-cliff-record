import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return (
		<main className="flex basis-full flex-col gap-4 overflow-hidden p-3">
			<div className="flex grow-0 basis-full gap-4 overflow-x-auto">Under construction.</div>
		</main>
	);
}
