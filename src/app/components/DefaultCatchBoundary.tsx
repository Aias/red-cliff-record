import { Button } from '@radix-ui/themes';
import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	console.error('DefaultCatchBoundary Error:', error);

	return (
		<div className="flex max-w-lg flex-col items-center justify-center gap-4 p-4">
			<ErrorComponent error={error} />
			<div className="flex flex-wrap items-center gap-2">
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
	);
}
