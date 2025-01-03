import { Link } from '@tanstack/react-router';
import { Text, Button } from '@radix-ui/themes';

export function NotFound() {
	return (
		<main className="p-4">
			<section className="flex flex-col gap-4">
				<Text color="gray" as="p">
					The page you are looking for does not exist.
				</Text>
				<nav className="flex gap-2 items-center flex-wrap">
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
