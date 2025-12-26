import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@/components/button';

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
				<Button variant="default" onClick={() => void router.invalidate()}>
					Try Again
				</Button>
				{isRoot ? (
					<Button render={<Link to="/" />}>Home</Button>
				) : (
					<Button
						variant="default"
						render={<Link to="/" />}
						onClick={(e) => {
							e.preventDefault();
							window.history.back();
						}}
					>
						Go Back
					</Button>
				)}
			</div>
		</div>
	);
}
