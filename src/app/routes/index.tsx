import { useCallback, useEffect, useState } from 'react';
import { Avatar, TextField } from '@radix-ui/themes';
import { Checkbox as RadixCheckbox } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ExternalLinkIcon, SearchIcon } from '~/app/components/icons';
import { trpc } from '../trpc';
import { Checkbox } from '~/components';

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
	description,
	type,
	url,
	imageUrl,
	subType,
}: {
	title: string;
	description?: string | null;
	type: 'record' | 'index';
	url?: string | null;
	imageUrl?: string | null;
	subType?: string | null;
	onClick?: () => void;
}) {
	return (
		<div className="flex w-full items-start gap-3 py-2 text-sm">
			<Avatar
				size="2"
				src={imageUrl ?? undefined}
				fallback={title[0]?.toUpperCase() ?? '?'}
				color={type === 'record' ? 'blue' : 'purple'}
			/>
			<div className="flex flex-1 flex-col items-start gap-1">
				<div className="flex w-full items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						{url ? (
							<a href={url} target="_blank" rel="noopener noreferrer" className="font-medium">
								{title}
								<ExternalLinkIcon className="opacity-75" />
							</a>
						) : (
							<span className="font-medium">{title}</span>
						)}
						{subType && <span className="text-secondary">{subType}</span>}
					</div>
					<span className="text-secondary capitalize">{type}</span>
				</div>
				{description && <span className="line-clamp-2 text-secondary">{description}</span>}
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

	const recordsQuery = trpc.records.search.useQuery(debouncedValue, {
		enabled: debouncedValue.length > 0,
	});
	const indicesQuery = trpc.indices.search.useQuery(debouncedValue, {
		enabled: debouncedValue.length > 0,
	});

	const isLoading = recordsQuery.isLoading || indicesQuery.isLoading;
	const hasResults = (recordsQuery.data?.length ?? 0) > 0 || (indicesQuery.data?.length ?? 0) > 0;

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	}, []);

	return (
		<main className="flex basis-full flex-col items-center gap-4 overflow-hidden p-3">
			<p className="flex gap-2">
				<label className="inline-flex items-center gap-1.5 text-sm">
					<Checkbox />
					Checkbox label
				</label>
				<label className="1ext-base inline-flex items-center gap-1.5">
					<Checkbox />
					Checkbox label
				</label>{' '}
				<Checkbox checked /> <Checkbox disabled /> <Checkbox checked disabled />
			</p>
			<p className="flex gap-2">
				<RadixCheckbox /> <RadixCheckbox checked /> <RadixCheckbox disabled />{' '}
				<RadixCheckbox checked disabled />
			</p>
			<div className="flex w-full max-w-2xl flex-col items-center gap-8 pt-12">
				<h1 className="text-center text-4xl font-medium text-balance">The Red Cliff Record</h1>

				<TextField.Root
					className="w-full"
					size="3"
					placeholder="Search records and indices..."
					value={inputValue}
					onChange={handleChange}
				>
					<TextField.Slot>
						<SearchIcon />
					</TextField.Slot>
				</TextField.Root>

				{debouncedValue.length > 0 && (
					<div className="flex w-full flex-col gap-6">
						{isLoading ? (
							<span className="text-center text-secondary">Searching...</span>
						) : !hasResults ? (
							<span className="text-center text-secondary">No results found</span>
						) : (
							<>
								{(recordsQuery.data?.length ?? 0) > 0 && (
									<SearchSection title="Records" count={recordsQuery.data?.length ?? 0}>
										{recordsQuery.data?.map((record) => (
											<SearchResult
												key={record.id}
												title={record.title ?? ''}
												description={record.summary ?? record.content}
												type="record"
												url={record.url}
												imageUrl={record.recordMedia?.[0]?.media.url}
											/>
										))}
									</SearchSection>
								)}

								{(indicesQuery.data?.length ?? 0) > 0 && (
									<>
										{(recordsQuery.data?.length ?? 0) > 0 && <hr />}
										<SearchSection title="Indices" count={indicesQuery.data?.length ?? 0}>
											{indicesQuery.data?.map((index) => (
												<SearchResult
													key={index.id}
													title={index.name}
													description={index.notes}
													type="index"
													url={index.canonicalUrl}
													imageUrl={
														index.canonicalMedia?.url ?? index.canonicalMediaUrl ?? undefined
													}
													subType={index.subType}
												/>
											))}
										</SearchSection>
									</>
								)}
							</>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
