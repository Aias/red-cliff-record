import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@/components';
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
				<Button variant="default" onClick={() => router.invalidate()}>
					Try Again
				</Button>
				{isRoot ? (
					<Button variant="secondary" asChild>
						<Link to="/">Home</Link>
					</Button>
				) : (
					<Button
						variant="default"
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
