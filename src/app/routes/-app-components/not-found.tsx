import { Link } from '@tanstack/react-router';
import { Button } from '@/components';

export function NotFound() {
	return (
		<main className="flex items-center justify-center p-4">
			<section className="flex flex-col items-center gap-4">
				<p className="text-c-secondary">The page you are looking for does not exist.</p>
				<nav className="flex flex-wrap items-center gap-2">
					<Button variant="default" onClick={() => window.history.back()}>
						Go back
					</Button>
					<Button variant="secondary" asChild>
						<Link to="/">Start Over</Link>
					</Button>
				</nav>
			</section>
		</main>
	);
}
