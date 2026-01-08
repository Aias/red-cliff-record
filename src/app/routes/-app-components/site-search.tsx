import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusCircleIcon, SearchIcon } from 'lucide-react';
import { useRecordSearch } from '@/app/lib/hooks/use-record-search';
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
import { cn } from '@/lib/utils';
import { defaultQueueOptions } from '@/shared/types';

export const SiteSearch = () => {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState('');
	const [commandOpen, setCommandOpen] = useState(false);

	const createRecordMutation = useUpsertRecord();

	const {
		textResults,
		vectorResults,
		textFetching,
		vectorFetching,
		isLoading,
		hasResults,
		shouldSearch,
	} = useRecordSearch(inputValue, {
		debounceMs: 300,
		minQueryLength: 2,
		textLimit: 10,
		vectorLimit: 5,
	});

	const handleInputChange = (search: string) => {
		setInputValue(search);
	};

	const handleSelectResult = (recordId: number) => {
		setCommandOpen(false);
		setInputValue('');
		void navigate({
			to: '/records/$recordId',
			params: { recordId },
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
						<SearchIcon className="text-c-hint" />
						<span>Search records...</span>
						<kbd className="pointer-events-none inline-flex items-center gap-1 rounded border border-c-border bg-c-mist px-1.5 font-mono font-medium text-c-secondary select-none">
							<span className="text-xs text-c-hint">⌘</span>K
						</kbd>
					</Button>
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
								{!shouldSearch
									? 'Type to search...'
									: !isLoading && !hasResults
										? 'No results found.'
										: ''}
							</CommandEmpty>

							{/* Text Search Section */}
							{shouldSearch && (
								<CommandGroup heading="Text Search Results">
									{textFetching ? (
										<CommandItem disabled className="flex items-center justify-center">
											<Spinner className="size-4" />
										</CommandItem>
									) : (
										textResults.map((record) => (
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
							{shouldSearch && (
								<CommandGroup heading="Similar Records">
									{vectorFetching ? (
										<CommandItem disabled className="flex items-center justify-center">
											<Spinner className="size-4" />
										</CommandItem>
									) : (
										vectorResults.map((record) => (
											<CommandItem
												key={`vector-${record.id}`}
												value={`${record.title || 'Untitled'}--${record.id}--vector`}
												onSelect={() => handleSelectResult(record.id)}
											>
												<SearchResultItem result={record} />
											</CommandItem>
										))
									)}
								</CommandGroup>
							)}

							{shouldSearch && <CommandSeparator alwaysRender />}

							<CommandItem
								disabled={inputValue.length === 0 || isLoading}
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
