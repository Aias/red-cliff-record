import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	return (
		<main className="flex basis-full flex-col items-center gap-4 overflow-hidden">
			<div className="flex w-full max-w-2xl basis-full flex-col items-center gap-8 overflow-hidden p-3 pt-12">
				<h1 className="text-center text-4xl font-medium text-balance">The Red Cliff Record</h1>

				{/* Placeholder for potential future content on the home page */}
				<p className="text-c-secondary">Welcome.</p>
			</div>
		</main>
	);
}
