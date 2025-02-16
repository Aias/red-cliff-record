import { Button } from '@radix-ui/themes';
import { Link } from '@tanstack/react-router';

export function NotFound() {
	return (
		<main className="flex items-center justify-center p-4">
			<section className="flex flex-col items-center gap-4">
				<p className="text-secondary">The page you are looking for does not exist.</p>
				<nav className="flex flex-wrap items-center gap-2">
					<Button variant="solid" color="green" onClick={() => window.history.back()}>
						Go back
					</Button>
					<Button variant="solid" color="blue" asChild>
						<Link to="/">Start Over</Link>
					</Button>
				</nav>
			</section>
		</main>
	);
}
