import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusCircle as PlusCircleIcon, MagnifyingGlass as SearchIcon } from '@phosphor-icons/react';
import { trpc } from '@/app/trpc';
import { SearchResultItem } from '../records/-components/search-result-item';
import { Button } from '@/components/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '@/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { defaultQueueOptions } from '@/shared/types';

export const SiteSearch = () => {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState('');
	const [commandOpen, setCommandOpen] = useState(false);
	const deferredValue = useDeferredValue(inputValue);
	const debouncedValue = useDebounce(deferredValue, 300);

	const createRecordMutation = useUpsertRecord();

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
		void navigate({
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
				<PopoverTrigger
					render={
						<Button
							variant="outline"
							className={cn(
								'relative inline-flex justify-start gap-4 rounded-md text-sm font-normal text-foreground shadow-none'
							)}
							role="combobox"
							aria-expanded={commandOpen}
						/>
					}
				>
					<SearchIcon className="text-muted-foreground" />
					<span>Search records...</span>
					<kbd className="pointer-events-none inline-flex items-center gap-1 rounded border border-input bg-muted px-1.5 font-mono font-medium text-muted-foreground select-none">
						<span className="text-xs text-muted-foreground">⌘</span>K
					</kbd>
				</PopoverTrigger>
				<PopoverContent className="w-150 overflow-auto p-0" align="end">
					<Command shouldFilter={false} loop defaultValue="">
						<CommandInput
							placeholder="Search records..."
							value={inputValue}
							onValueChange={handleInputChange}
						/>
						<CommandList className="max-h-[75vh]">
							<CommandItem value="-" className="hidden" />
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

							{debouncedValue.length > 1 && <CommandSeparator alwaysRender />}

							<CommandItem
								disabled={inputValue.length === 0 || textResultsLoading || similarityResultsLoading}
								key="create-record"
								onSelect={() => {
									createRecordMutation.mutate(
										{ type: 'artifact', title: inputValue },
										{ onSuccess: (newRecord) => handleSelectResult(newRecord.id) }
									);
								}}
								className="px-3 py-2"
							>
								<PlusCircleIcon /> Create New Record
							</CommandItem>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	);
};
