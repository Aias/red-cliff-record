import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
import {
	Avatar,
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { parseToSingleLine } from '@/lib/marked';
import { cn } from '@/lib/utils';

interface SearchResultProps {
	id: number;
	title: string;
	content?: string | null;
	url?: string | null;
	imageUrl?: string | null;
}

export function SearchResult({ title, content, imageUrl, id }: SearchResultProps) {
	return (
		<div className="flex w-full gap-3 py-2 text-sm">
			<Avatar src={imageUrl ?? undefined} fallback={title[0]?.toUpperCase() ?? '?'} />
			<div className="flex flex-1 flex-col gap-1">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Link
							to="/records/$recordId"
							params={{ recordId: id.toString() }}
							className="font-medium"
							// Prevent link navigation (handled by combobox)
							onClick={(e) => e.preventDefault()}
						>
							{title}
						</Link>
					</div>
				</div>
				{content && (
					<span
						className="line-clamp-2 text-c-secondary"
						dangerouslySetInnerHTML={{
							__html: parseToSingleLine(content),
						}}
					/>
				)}
			</div>
		</div>
	);
}

export const SiteSearch = () => {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState('');
	const [textEmbedding, setTextEmbedding] = useState<number[] | null>(null);
	const [commandOpen, setCommandOpen] = useState(false);
	const debouncedValue = useDebounce(inputValue, 300);

	const { data: textResults, isLoading: textResultsLoading } = trpc.records.search.useQuery(
		{
			query: debouncedValue,
			limit: 5,
		},
		{
			enabled: debouncedValue.length > 1,
		}
	);
	const { data: similarityResults, isLoading: similarityResultsLoading } =
		trpc.records.similaritySearch.useQuery(
			{
				vector: textEmbedding!, // Assert non-null because enabled is true only if it exists
				limit: 5,
			},
			{
				enabled: textEmbedding !== null,
			}
		);
	const embedMutation = trpc.admin.createEmbedding.useMutation({
		onSuccess: (data) => {
			console.log('embedding created');
			setTextEmbedding(data);
		},
	});

	const handleInputChange = (search: string) => {
		setInputValue(search);
	};

	const handleSelectResult = (recordId: number) => {
		setCommandOpen(false);
		setInputValue('');
		navigate({
			to: '/records/$recordId',
			params: { recordId: recordId.toString() },
			search: (prev) => ({ ...defaultQueueOptions, ...prev }),
		});
	};

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
				if (
					(e.target instanceof HTMLElement && e.target.isContentEditable) ||
					e.target instanceof HTMLInputElement ||
					e.target instanceof HTMLTextAreaElement ||
					e.target instanceof HTMLSelectElement
				) {
					return;
				}

				e.preventDefault();
				setCommandOpen((open) => !open);
			}
		};

		document.addEventListener('keydown', down);
		return () => document.removeEventListener('keydown', down);
	}, []);

	useEffect(() => {
		if (debouncedValue.length > 1) {
			console.log('starting embedding for ', debouncedValue);
			embedMutation.mutate(debouncedValue);
		} else {
			setTextEmbedding(null);
		}
	}, [debouncedValue]);

	return (
		<>
			<Popover open={commandOpen} onOpenChange={setCommandOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className={cn(
							'relative inline-flex justify-start gap-4 rounded-md text-sm font-normal text-c-primary shadow-none'
						)}
						role="combobox"
						aria-expanded={commandOpen}
					>
						<SearchIcon />
						<span>Search records...</span>
						<kbd className="pointer-events-none inline-flex items-center gap-1 rounded border border-c-border bg-c-mist px-1.5 font-mono font-medium text-c-secondary select-none">
							<span className="text-xs text-c-hint">⌘</span>K
						</kbd>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-150 p-0" align="end">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Search records..."
							value={inputValue}
							onValueChange={handleInputChange}
						/>
						<CommandList>
							<CommandEmpty>
								{(textResultsLoading ||
									(embedMutation.isPending && debouncedValue.length > 1) ||
									similarityResultsLoading) &&
								debouncedValue.length > 1
									? 'Loading...'
									: 'No results found.'}
							</CommandEmpty>
							{debouncedValue.length > 1 && !textResultsLoading && textResults && (
								<CommandGroup heading="Text Search Results">
									{textResults.map((record) => (
										<CommandItem
											key={`text-${record.id}`}
											value={record.title ?? record.id.toString()}
											onSelect={() => handleSelectResult(record.id)}
											className="flex w-full cursor-pointer"
										>
											<SearchResult
												id={record.id}
												title={record.title ?? 'Untitled'}
												content={record.content || record.summary || record.notes || undefined}
												url={record.url}
												imageUrl={record.media[0]?.url}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							)}
							{!similarityResultsLoading && similarityResults && similarityResults.length > 0 && (
								<CommandGroup heading="Similar Records">
									{similarityResults.map((record) => (
										<CommandItem
											key={`sim-${record.id}-${record.similarity}`}
											value={`${record.title ?? record.id.toString()} (Similarity: ${record.similarity.toFixed(2)})`}
											onSelect={() => handleSelectResult(record.id)}
											className="flex w-full cursor-pointer"
										>
											<SearchResult
												id={record.id}
												title={record.title ?? 'Untitled'}
												content={record.content || record.summary || record.notes || undefined}
												url={record.url}
												imageUrl={record.avatarUrl}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
};
