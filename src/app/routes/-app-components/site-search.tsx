import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { trpc } from '@/app/trpc';
import { defaultQueueOptions } from '@/server/api/routers/types';
import { SearchResultItem } from '../records/-components/search-result-item';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { cn } from '@/lib/utils';

export const SiteSearch = () => {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState('');
	const [commandOpen, setCommandOpen] = useState(false);
	const deferredValue = useDeferredValue(inputValue);
	const debouncedValue = useDebounce(deferredValue, 300);

	const { data: textResults, isLoading: textResultsLoading } = trpc.search.byTextQuery.useQuery(
		{
			query: debouncedValue,
			limit: 10,
		},
		{
			enabled: debouncedValue.length > 1,
			trpc: {
				context: {
					skipBatch: true,
				},
			},
		}
	);
	const { data: similarityResults, isLoading: similarityResultsLoading } =
		trpc.search.byVector.useQuery(
			{
				query: debouncedValue,
				limit: 5,
			},
			{
				enabled: debouncedValue.length > 1,
				trpc: {
					context: {
						skipBatch: true,
					},
				},
			}
		);

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
					<Command shouldFilter={false} loop>
						<CommandInput
							placeholder="Search records..."
							value={inputValue}
							onValueChange={handleInputChange}
						/>
						<CommandList className="max-h-[75vh]">
							<CommandEmpty>
								{debouncedValue.length <= 1
									? 'Type to search...'
									: !textResultsLoading &&
										  !similarityResultsLoading &&
										  (!textResults || textResults.length === 0) &&
										  (!similarityResults || similarityResults.length === 0)
										? 'No results found.'
										: ''}
							</CommandEmpty>

							{/* Text Search Section */}
							{debouncedValue.length > 1 && (
								<CommandGroup heading="Text Search Results">
									{textResultsLoading ? (
										<CommandItem disabled className="flex items-center justify-center">
											<Spinner className="size-4" />
										</CommandItem>
									) : (
										textResults?.map((record) => (
											<CommandItem
												key={`text-${record.id}`}
												value={`${record.title || 'Untitled'}--${record.id}--text`}
												onSelect={() => handleSelectResult(record.id)}
											>
												<SearchResultItem result={record} />
											</CommandItem>
										))
									)}
								</CommandGroup>
							)}

							{/* Similarity Search Section */}
							{debouncedValue.length > 1 && (
								<CommandGroup heading="Similar Records">
									{similarityResultsLoading ? (
										<CommandItem disabled className="flex items-center justify-center">
											<Spinner className="size-4" />
										</CommandItem>
									) : (
										similarityResults?.map((record) => (
											<CommandItem
												key={`sim-${record.id}`}
												value={`${record.title || 'Untitled'}--${record.id}--similarity`}
												onSelect={() => handleSelectResult(record.id)}
											>
												<SearchResultItem result={record} />
											</CommandItem>
										))
									)}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
};
