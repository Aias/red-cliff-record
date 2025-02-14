import { useCallback, useEffect, useState } from 'react';
import { ExternalLinkIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Avatar, Heading, Link, Separator, Text, TextField } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '../trpc';

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
	const TitleComponent = url ? Link : Text;
	const titleProps = url
		? {
				href: url,
				target: '_blank',
				rel: 'noopener noreferrer',
			}
		: {};

	return (
		<div className="flex w-full items-start gap-3 p-2 text-left">
			<Avatar
				size="2"
				src={imageUrl ?? undefined}
				fallback={title[0]?.toUpperCase() ?? '?'}
				color={type === 'record' ? 'blue' : 'purple'}
			/>
			<div className="flex flex-1 flex-col items-start gap-1">
				<div className="flex w-full items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<TitleComponent size="2" weight="medium" {...titleProps}>
							{title}
							{url && <ExternalLinkIcon className="ml-1 inline-block size-3" />}
						</TitleComponent>
						{subType && (
							<Text size="1" color="gray">
								{subType}
							</Text>
						)}
					</div>
					<Text size="1" color="gray">
						{type}
					</Text>
				</div>
				{description && (
					<Text size="1" color="gray" className="line-clamp-2">
						{description}
					</Text>
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
			<div className="flex items-baseline justify-between">
				<Heading size="3" mb="2">
					{title}
				</Heading>
				<Text size="1" color="gray">
					{count} result{count === 1 ? '' : 's'}
				</Text>
			</div>
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
			<div className="flex w-full max-w-2xl flex-col items-center gap-8 pt-12">
				<Heading size="8" align="center">
					The Red Cliff Record
				</Heading>

				<TextField.Root
					className="w-full"
					size="3"
					placeholder="Search records and indices..."
					value={inputValue}
					onChange={handleChange}
				>
					<TextField.Slot>
						<MagnifyingGlassIcon height="16" width="16" />
					</TextField.Slot>
				</TextField.Root>

				{debouncedValue.length > 0 && (
					<div className="flex w-full flex-col gap-6">
						{isLoading ? (
							<Text align="center" color="gray">
								Searching...
							</Text>
						) : !hasResults ? (
							<Text align="center" color="gray">
								No results found
							</Text>
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
										{(recordsQuery.data?.length ?? 0) > 0 && <Separator size="4" />}
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
