import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { RecordTypeIcon } from './type-icons';
import {
	CheckIcon,
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

export const RecordsGrid = () => {
	const search = useSearch({
		from: '/records',
	});
	const navigate = useNavigate({
		from: '/records',
	});
	const { data: queue } = trpc.records.list.useQuery(search);

	const {
		filters: { type, title, url, isCurated, isFormat, isIndexNode, isPrivate, source, hasParent },
		limit,
	} = search;

	const handleTypeChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					type: value === 'All' ? undefined : (value as RecordType),
				},
			}),
		});
	};

	const handleCuratedChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					isCurated: value === 'All' ? undefined : value === 'Yes' ? true : false,
				},
			}),
		});
	};

	const handleIndexNodeChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					isIndexNode: value === 'All' ? undefined : value === 'Yes' ? true : false,
				},
			}),
		});
	};

	const handleFormatChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					isFormat: value === 'All' ? undefined : value === 'Yes' ? true : false,
				},
			}),
		});
	};

	const handlePrivateChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					isPrivate: value === 'All' ? undefined : value === 'Yes' ? true : false,
				},
			}),
		});
	};

	const handleHasParentChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					hasParent: value === 'All' ? undefined : value === 'Yes' ? true : false,
				},
			}),
		});
	};

	const handleSourceChange = (value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				filters: {
					...prev.filters,
					source: value === 'All' ? undefined : (value as IntegrationType),
				},
			}),
		});
	};

	// State for input values
	const [titleInput, setTitleInput] = useState(title ?? '');
	const [urlInput, setUrlInput] = useState(url ?? '');
	const [limitInput, setLimitInput] = useState(limit?.toString() ?? '');

	// Update input states when search params change
	useEffect(() => {
		setTitleInput(title ?? '');
		setUrlInput(url ?? '');
		setLimitInput(limit?.toString() ?? '');
	}, [title, url, limit]);

	// Debounced handlers for text inputs
	useEffect(() => {
		const timer = setTimeout(() => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						title: titleInput.trim() === '' ? undefined : titleInput.trim(),
					},
				}),
			});
		}, 500);

		return () => clearTimeout(timer);
	}, [titleInput, navigate]);

	useEffect(() => {
		const timer = setTimeout(() => {
			navigate({
				search: (prev) => ({
					...prev,
					filters: {
						...prev.filters,
						url: urlInput.trim() === '' ? undefined : urlInput.trim(),
					},
				}),
			});
		}, 500);

		return () => clearTimeout(timer);
	}, [urlInput, navigate]);

	useEffect(() => {
		const timer = setTimeout(() => {
			const parsedLimit = limitInput === '' ? undefined : parseInt(limitInput, 10);

			// Only update if it's a valid number or undefined
			if (parsedLimit === undefined || !isNaN(parsedLimit)) {
				navigate({
					search: (prev) => ({
						...prev,
						limit: parsedLimit,
					}),
				});
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [limitInput, navigate]);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitleInput(e.target.value);
	};

	const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setUrlInput(e.target.value);
	};

	const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Only allow positive numbers
		const value = e.target.value;
		if (value === '' || /^\d+$/.test(value)) {
			setLimitInput(value);
		}
	};

	const curatedValue = isCurated === undefined ? 'All' : isCurated ? 'Yes' : 'No';
	const indexNodeValue = isIndexNode === undefined ? 'All' : isIndexNode ? 'Yes' : 'No';
	const formatValue = isFormat === undefined ? 'All' : isFormat ? 'Yes' : 'No';
	const privateValue = isPrivate === undefined ? 'All' : isPrivate ? 'Yes' : 'No';
	const hasParentValue = hasParent === undefined ? 'All' : hasParent ? 'Yes' : 'No';

	return queue ? (
		<div className="flex h-full grow overflow-hidden">
			<div className="mr-4 flex min-w-48 flex-col gap-3 border-r border-border pr-4 text-sm">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="type">Type</Label>
					<Select value={type ?? 'All'} onValueChange={handleTypeChange}>
						<SelectTrigger id="type">
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
						<SelectTrigger id="source">
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
						value={curatedValue}
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
						value={indexNodeValue}
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
						value={formatValue}
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
						value={hasParentValue}
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
					<Label htmlFor="private">Is Private?</Label>
					<ToggleGroup
						id="private"
						type="single"
						value={privateValue}
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
				<div className="flex flex-col gap-1.5">
					<Link
						to="/records"
						search={(prev) => ({
							...prev,
							filters: {
								isCurated: false,
								isIndexNode: true,
							},
						})}
						className="mt-3 block w-full border-t border-border pt-3 text-center"
					>
						Index Queue
					</Link>
				</div>
			</div>
			<div className="flex grow overflow-hidden rounded border border-border bg-rcr-surface text-xs">
				<Table className={cn({ 'h-full': queue.length === 0 })}>
					<TableHeader className="sticky top-0 z-10 bg-rcr-surface before:absolute before:right-0 before:bottom-0 before:left-0 before:h-[0.5px] before:bg-border">
						<TableRow className="sticky top-0 z-10 bg-rcr-tint">
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
							queue.map((record) => (
								<TableRow key={record.id}>
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
													{record.title || record.summary || record.content}
												</Link>
											</TooltipTrigger>
											<TooltipContent>
												{record.title || record.summary || record.content}
											</TooltipContent>
										</Tooltip>
									</TableCell>
									<TableCell>
										{record.creators.map((creator) => creator.creator.title).join(', ')}
									</TableCell>
									<TableCell>{record.format?.title}</TableCell>
									<TableCell className="whitespace-nowrap">
										{record.url ? (
											<ExternalLink href={record.url}>{new URL(record.url).hostname}</ExternalLink>
										) : (
											''
										)}
									</TableCell>
									<TableCell>{record.parentId}</TableCell>
									<TableCell className="text-center">{record.rating}</TableCell>
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
										<div className="flex justify-center gap-1 text-[0.875em]">
											{record.sources?.map((source) => (
												<IntegrationLogo integration={source} key={source} />
											))}
										</div>
									</TableCell>
								</TableRow>
							))
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
