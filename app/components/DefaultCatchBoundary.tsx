import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button, Container } from '@radix-ui/themes';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	console.error('DefaultCatchBoundary Error:', error);

	return (
		<Container size="1">
			<div className="flex flex-col items-center justify-center gap-4 p-4">
				<ErrorComponent error={error} />
				<div className="flex gap-2 items-center flex-wrap">
					<Button variant="solid" color="gray" onClick={() => router.invalidate()}>
						Try Again
					</Button>
					{isRoot ? (
						<Button variant="solid" color="gray" asChild>
							<Link to="/">Home</Link>
						</Button>
					) : (
						<Button
							variant="solid"
							color="gray"
							asChild
							onClick={(e) => {
								e.preventDefault();
								window.history.back();
							}}
						>
							<Link to="/">Go Back</Link>
						</Button>
					)}
				</div>
			</div>
		</Container>
	);
}
