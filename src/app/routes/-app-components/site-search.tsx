import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/records.types';
import { RecordLink } from '../records/-components/record-link';
import {
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
import { cn } from '@/lib/utils';

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
				<PopoverContent className="w-150 overflow-auto p-0" align="end">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Search records..."
							value={inputValue}
							onValueChange={handleInputChange}
						/>
						<CommandList className="max-h-[75vh]">
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
											className="flex w-full cursor-pointer px-3 py-2"
										>
											<RecordLink toRecord={record} className="flex-1" />
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
											className="flex w-full cursor-pointer px-3 py-2"
										>
											<RecordLink toRecord={record} className="flex-1" />
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
