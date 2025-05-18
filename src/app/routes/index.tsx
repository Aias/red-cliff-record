import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import { useRecordList } from '@/lib/hooks/use-records';

export const Route = createFileRoute('/')({
	component: Home,
});

function Home() {
	const { records, isLoading, isError } = useRecordList({
		filters: {
			hasMedia: true,
		},
		limit: 100,
		offset: 0,
		orderBy: [{ field: 'recordUpdatedAt', direction: 'desc' }],
	});

	return (
		<main className="flex basis-full flex-col items-center gap-4 overflow-y-auto p-1">
			{isLoading && <Spinner className="size-8" />}
			{isError && <p className="text-c-destructive">Error loading records.</p>}
			{!isLoading && !isError && records.length === 0 && (
				<p className="text-c-hint">No records with media found.</p>
			)}
			<div className="grid w-full [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-0.5">
				{records.map((record) => {
					const item = record.media?.[0]; // Get only the first media item
					if (!item) return null; // Skip if no media

					return (
						<Link
							key={item.id}
							to="/records/$recordId"
							params={{ recordId: record.id.toString() }}
							className="focus-visible:ring-c-ring relative block aspect-[3/2] overflow-hidden rounded-sm border border-c-divider bg-c-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-c-background focus-visible:outline-none"
						>
							{/* Gradient from bottom 50% with semi-transparent black */}
							<div className="pointer-events-none absolute inset-x-0 top-1/2 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent opacity-75" />
							{item.type === 'video' ? (
								<LazyVideo
									src={item.url}
									className="absolute inset-0 size-full object-cover"
									muted
									loop
									playsInline
									autoPlay
								/>
							) : (
								<img
									src={item.url}
									alt={item.altText || record.title || `Media for record ${record.id}`}
									className="absolute inset-0 size-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							)}
							{/* White text with semi-transparent black shadow */}
							<div
								className="absolute right-0 bottom-0 left-0 z-20 truncate p-2 text-xs text-white"
								style={{ textShadow: '0 0 4px rgba(0, 0, 0)' }} // Use rgba for black shadow
							>
								{record.title || 'Untitled Record'}
							</div>
						</Link>
					);
				})}
			</div>
		</main>
	);
}
