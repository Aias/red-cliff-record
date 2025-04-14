import { memo, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { CheckIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
import { type RecordWithRelations } from '@/server/api/routers/records.types';
import { RecordTypeIcon } from './type-icons';
import {
	ExternalLink,
	Input,
	IntegrationLogo,
	Label,
	Placeholder,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	ToggleGroup,
	ToggleGroupItem,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components';
import {
	IntegrationTypeSchema,
	RecordTypeSchema,
	type IntegrationType,
	type RecordType,
} from '@/db/schema';
import { cn } from '@/lib/utils';

const RecordRow = memo(function RecordRow({ record }: { record: RecordWithRelations }) {
	const title = record.title || record.summary || record.content || 'Untitled Record';

	return (
		<TableRow>
			<TableCell className="text-center text-sm">
				<RecordTypeIcon type={record.type} />
			</TableCell>
			<TableCell className="max-w-60 truncate whitespace-nowrap">
				<Tooltip delayDuration={500}>
					<TooltipTrigger asChild>
						<Link
							to="/records/$recordId"
							params={{ recordId: record.id.toString() }}
							className="block w-full truncate"
						>
							{title}
						</Link>
					</TooltipTrigger>
					<TooltipContent>{title}</TooltipContent>
				</Tooltip>
			</TableCell>
			<TableCell>
				{record.creators
					?.map((creator) => creator.title || '')
					.filter(Boolean)
					.join(', ')}
			</TableCell>
			<TableCell>{record.format?.title || ''}</TableCell>
			<TableCell className="whitespace-nowrap">
				{record.url ? (
					<ExternalLink href={record.url}>{new URL(record.url).hostname}</ExternalLink>
				) : (
					''
				)}
			</TableCell>
			<TableCell>{record.parentId}</TableCell>
			<TableCell className="text-center">
				{record.rating && record.rating > 0 ? '⭐'.repeat(record.rating) : ''}
			</TableCell>
			<TableCell className="text-center text-base">
				{record.isIndexNode ? <CheckIcon /> : null}
			</TableCell>
			<TableCell className="text-center text-base">
				{record.isFormat ? <CheckIcon /> : null}
			</TableCell>
			<TableCell className="text-center text-base">
				{record.isPrivate ? <CheckIcon /> : null}
			</TableCell>
			<TableCell className="text-center text-base">
				{record.isCurated ? <CheckIcon /> : null}
			</TableCell>
			<TableCell className="text-center">
				<div className="flex justify-center gap-1">
					{record.sources?.map((source) => (
						<IntegrationLogo integration={source} key={source} className="size-4" />
					))}
				</div>
			</TableCell>
		</TableRow>
	);
});

export const RecordsGrid = () => {
	const search = useSearch({
		from: '/records',
	});
	const navigate = useNavigate({
		from: '/records',
	});
	const { data: queue } = trpc.records.list.useQuery(search);

	const {
		filters: {
			type,
			title,
			url,
			isCurated,
			isFormat,
			isIndexNode,
			isPrivate,
			source,
			hasParent,
			text,
			hasEmbedding,
		},
		limit,
	} = search;

	// Memoize filter values
	const filterValues = useMemo(
		() => ({
			curatedValue: isCurated === undefined ? 'All' : isCurated ? 'Yes' : 'No',
			indexNodeValue: isIndexNode === undefined ? 'All' : isIndexNode ? 'Yes' : 'No',
			formatValue: isFormat === undefined ? 'All' : isFormat ? 'Yes' : 'No',
			privateValue: isPrivate === undefined ? 'All' : isPrivate ? 'Yes' : 'No',
			hasParentValue: hasParent === undefined ? 'All' : hasParent ? 'Yes' : 'No',
			hasEmbeddingValue: hasEmbedding === undefined ? 'All' : hasEmbedding ? 'Yes' : 'No',
		}),
		[isCurated, isIndexNode, isFormat, isPrivate, hasParent, hasEmbedding]
	);

	// State for input fields
	const [titleInput, setTitleInput] = useState(title ?? '');
	const [urlInput, setUrlInput] = useState(url ?? '');
	const [textInput, setTextInput] = useState(text ?? '');
	const [limitInput, setLimitInput] = useState(limit?.toString() ?? '');

	// Debounced navigation handlers
	const handleTitleChange = useMemo(() => {
		const handler = (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setTitleInput(value);
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						title: value || undefined,
					},
				}),
			});
		};
		return handler;
	}, [navigate]);

	const handleUrlChange = useMemo(() => {
		const handler = (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setUrlInput(value);
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						url: value || undefined,
					},
				}),
			});
		};
		return handler;
	}, [navigate]);

	const handleTextChange = useMemo(() => {
		const handler = (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setTextInput(value);
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						text: value || undefined,
					},
				}),
			});
		};
		return handler;
	}, [navigate]);

	const handleTypeChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						type: value === 'All' ? undefined : (value as RecordType),
					},
				}),
			});
		},
		[navigate]
	);

	const handleSourceChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						source: value === 'All' ? undefined : (value as IntegrationType),
					},
				}),
			});
		},
		[navigate]
	);

	const handleCuratedChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						isCurated: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handleIndexNodeChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						isIndexNode: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handleFormatChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						isFormat: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handlePrivateChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						isPrivate: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handleHasParentChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						hasParent: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handleHasEmbeddingChange = useCallback(
		(value: string) => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						hasEmbedding: value === 'All' ? undefined : value === 'Yes',
					},
				}),
			});
		},
		[navigate]
	);

	const handleLimitChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			if (value === '' || /^\d+$/.test(value)) {
				setLimitInput(value);
				if (value) {
					navigate({
						search: (prev) => ({
							...prev,
							limit: parseInt(value, 10),
						}),
					});
				}
			}
		},
		[navigate]
	);

	// Memoize the filter sidebar content
	const FilterSidebar = useMemo(
		() => (
			<div className="-mx-4 flex min-w-48 flex-col gap-3 overflow-y-auto px-4 text-sm">
				<h3 className="mb-1 text-base">Record Filters</h3>
				<hr />
				<div className="flex flex-col gap-1.5">
					<Link to="/records" search={defaultQueueOptions}>
						Reset to Defaults
					</Link>
					<Link
						to="/records"
						search={(prev) => ({
							...prev,
							filters: {
								isCurated: false,
								isIndexNode: true,
							},
						})}
					>
						Index Queue
					</Link>
				</div>
				<hr />
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="type">Type</Label>
					<Select value={type ?? 'All'} onValueChange={handleTypeChange}>
						<SelectTrigger id="type" className="w-full">
							<SelectValue placeholder="Filter by type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="All">All Types</SelectItem>
							{RecordTypeSchema.options.map((recordType) => (
								<SelectItem key={recordType} value={recordType}>
									{recordType.charAt(0).toUpperCase() + recordType.slice(1)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="source">Source</Label>
					<Select value={source ?? 'All'} onValueChange={handleSourceChange}>
						<SelectTrigger id="source" className="w-full">
							<SelectValue placeholder="Filter by source" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="All">All Sources</SelectItem>
							{IntegrationTypeSchema.options
								.filter((source) =>
									['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter'].includes(
										source
									)
								)
								.map((source) => (
									<SelectItem key={source} value={source}>
										{source.charAt(0).toUpperCase() + source.slice(1)}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						type="text"
						placeholder="Filter by title"
						value={titleInput}
						onChange={handleTitleChange}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="text">Text</Label>
					<Input
						id="text"
						type="text"
						placeholder="Filter by text content"
						value={textInput}
						onChange={handleTextChange}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="url">URL</Label>
					<Input
						id="url"
						type="text"
						placeholder="Filter by URL"
						value={urlInput}
						onChange={handleUrlChange}
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="curated">Is Curated?</Label>
					<ToggleGroup
						id="curated"
						type="single"
						value={filterValues.curatedValue}
						onValueChange={handleCuratedChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="indexNode">Is Index Node?</Label>
					<ToggleGroup
						id="indexNode"
						type="single"
						value={filterValues.indexNodeValue}
						onValueChange={handleIndexNodeChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="format">Is Format?</Label>
					<ToggleGroup
						id="format"
						type="single"
						value={filterValues.formatValue}
						onValueChange={handleFormatChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="hasParent">Has Parent?</Label>
					<ToggleGroup
						id="hasParent"
						type="single"
						value={filterValues.hasParentValue}
						onValueChange={handleHasParentChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="hasEmbedding">Has Embedding?</Label>
					<ToggleGroup
						id="hasEmbedding"
						type="single"
						value={filterValues.hasEmbeddingValue}
						onValueChange={handleHasEmbeddingChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="private">Is Private?</Label>
					<ToggleGroup
						id="private"
						type="single"
						value={filterValues.privateValue}
						onValueChange={handlePrivateChange}
						variant="outline"
						className="w-full"
					>
						<ToggleGroupItem value="All" className="flex-1">
							All
						</ToggleGroupItem>
						<ToggleGroupItem value="Yes" className="flex-1">
							Yes
						</ToggleGroupItem>
						<ToggleGroupItem value="No" className="flex-1">
							No
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="limit">Results Limit</Label>
					<Input
						id="limit"
						type="number"
						min="1"
						placeholder="Number of results"
						value={limitInput}
						onChange={handleLimitChange}
					/>
				</div>
			</div>
		),
		[
			type,
			handleTypeChange,
			source,
			handleSourceChange,
			titleInput,
			handleTitleChange,
			urlInput,
			handleUrlChange,
			textInput,
			handleTextChange,
			limitInput,
			handleLimitChange,
			filterValues,
			handleCuratedChange,
			handleIndexNodeChange,
			handleFormatChange,
			handlePrivateChange,
			handleHasParentChange,
		]
	);

	return queue ? (
		<div className="flex h-full grow gap-4 overflow-hidden">
			{FilterSidebar}
			<div className="flex grow overflow-hidden rounded border border-border bg-c-surface text-xs">
				<Table className={cn({ 'h-full': queue.length === 0 })}>
					<TableHeader className="sticky top-0 z-10 bg-c-surface before:absolute before:right-0 before:bottom-0 before:left-0 before:h-[0.5px] before:bg-border">
						<TableRow className="sticky top-0 z-10 bg-c-mist">
							<TableHead className="text-center">Type</TableHead>
							<TableHead>Record</TableHead>
							<TableHead>Creators</TableHead>
							<TableHead>Format</TableHead>
							<TableHead>URL</TableHead>
							<TableHead>Parent</TableHead>
							<TableHead className="text-center">Rating</TableHead>
							<TableHead className="text-center">Index?</TableHead>
							<TableHead className="text-center">Format?</TableHead>
							<TableHead className="text-center">Private?</TableHead>
							<TableHead className="text-center">Curated?</TableHead>
							<TableHead className="text-center">Sources</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{queue.length > 0 ? (
							queue.map((record) => <RecordRow key={record.id} record={record} />)
						) : (
							<TableRow>
								<TableCell colSpan={12} className="pointer-events-none text-center">
									No records found
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	) : (
		<Placeholder>
			<Spinner />
		</Placeholder>
	);
};
