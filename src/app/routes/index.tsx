import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '../trpc';
import { Avatar, Input } from '@/components';
import { parseToSingleLine } from '@/lib/marked';

const SearchSchema = z.object({
	q: z.string().optional(),
});

export const Route = createFileRoute('/')({
	validateSearch: SearchSchema,
	component: Home,
});

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);

	return debouncedValue;
}

function SearchResult({
	title,
	content,
	type,
	imageUrl,
	subType,
	id,
}: {
	id: number;
	title: string;
	content?: string | null;
	type: 'record' | 'index';
	url?: string | null;
	imageUrl?: string | null;
	subType?: string | null;
	onClick?: () => void;
}) {
	return (
		<div className="flex gap-3 py-2 text-sm">
			<Avatar src={imageUrl ?? undefined} fallback={title[0]?.toUpperCase() ?? '?'} />
			<div className="flex flex-1 flex-col gap-1">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Link
							to="/records/$recordId"
							params={{ recordId: id.toString() }}
							className="font-medium"
						>
							{title}
						</Link>
						{subType && <span className="text-rcr-secondary">{subType}</span>}
					</div>
					<span className="text-rcr-secondary capitalize">{type}</span>
				</div>
				{content && (
					<span
						className="line-clamp-2 text-rcr-secondary"
						dangerouslySetInnerHTML={{
							__html: parseToSingleLine(content),
						}}
					/>
				)}
			</div>
		</div>
	);
}

function SearchSection({
	title,
	children,
	count,
}: {
	title: string;
	children: React.ReactNode;
	count: number;
}) {
	return (
		<section className="flex w-full flex-col gap-1">
			<header className="mb-2 flex items-baseline justify-between">
				<h2>{title}</h2>
				<span>
					{count} result{count === 1 ? '' : 's'}
				</span>
			</header>
			{children}
		</section>
	);
}

function Home() {
	const { q = '' } = Route.useSearch();
	const navigate = Route.useNavigate();
	const [inputValue, setInputValue] = useState(q);
	const debouncedValue = useDebounce(inputValue, 300);

	// Keep input value in sync with URL param
	useEffect(() => {
		setInputValue(q);
	}, [q]);

	// Update URL when debounced value changes
	useEffect(() => {
		if (debouncedValue !== q) {
			navigate({
				search: (prev) => ({ ...prev, q: debouncedValue || undefined }),
				replace: true,
			});
		}
	}, [debouncedValue, navigate, q]);

	const recordsQuery = trpc.records.search.useQuery(
		{
			query: debouncedValue,
			limit: 10,
		},
		{
			enabled: debouncedValue.length > 0,
		}
	);

	const isLoading = recordsQuery.isLoading;
	const hasResults = (recordsQuery.data?.length ?? 0) > 0;

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	}, []);

	return (
		<main className="flex basis-full flex-col items-center gap-4 overflow-hidden">
			<div className="flex w-full max-w-2xl basis-full flex-col items-center gap-8 overflow-hidden p-3 pt-12">
				<h1 className="text-center text-4xl font-medium text-balance">The Red Cliff Record</h1>

				<Input
					className="shrink-0"
					type="search"
					placeholder="Search records and indices..."
					value={inputValue}
					onChange={handleChange}
				/>

				{debouncedValue.length > 0 && (
					<div className="-mx-4 flex flex-col gap-6 overflow-y-auto px-4">
						{isLoading ? (
							<span className="text-center text-rcr-secondary">Searching...</span>
						) : !hasResults ? (
							<span className="text-center text-rcr-secondary">No results found</span>
						) : (
							<SearchSection title="Records" count={recordsQuery.data?.length ?? 0}>
								{recordsQuery.data?.map((record) => (
									<SearchResult
										key={record.id}
										id={record.id}
										title={record.title ?? 'Untitled'}
										content={record.content || record.summary || record.notes || undefined}
										type="record"
										url={record.url}
										imageUrl={record.media[0]?.url}
									/>
								))}
							</SearchSection>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
