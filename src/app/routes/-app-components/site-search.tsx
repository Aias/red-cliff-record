import { useNavigate } from '@tanstack/react-router';
import { PlusCircleIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/app/trpc';
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
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { cn } from '@/lib/utils';
import { SearchResultItem } from '../records/-components/search-result-item';

const MIN_QUERY_LENGTH = 2;

export const SiteSearch = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandValue, setCommandValue] = useState('');

  const createRecordMutation = useUpsertRecord();

  const debouncedQuery = useDebounce(inputValue, 300);
  const shouldSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = trpc.records.search.useQuery(
    { query: debouncedQuery, limit: 10 },
    {
      enabled: shouldSearch,
      trpc: { context: { skipBatch: true } },
    }
  );

  const results = data?.items ?? [];
  const hasResults = results.length > 0;

  const handleInputChange = (search: string) => {
    setInputValue(search);
    setCommandValue('');
  };

  const handleSelectResult = (recordId: number) => {
    setCommandOpen(false);
    setInputValue('');
    void navigate({
      to: '/records/$recordId',
      params: { recordId },
    });
  };

  const handleNavigateToSearch = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setCommandOpen(false);
    setInputValue('');
    void navigate({ to: '/records', search: { q: trimmed } });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (!commandValue || commandValue === '-')) {
      e.preventDefault();
      handleNavigateToSearch();
    }
  };

  useKeyboardShortcut('mod+k', () => setCommandOpen((open) => !open), {
    description: 'Open search',
    category: 'Navigation',
    allowInInput: true,
  });

  useKeyboardShortcut('/', () => setCommandOpen((open) => !open), {
    description: 'Open search',
    category: 'Navigation',
  });

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
          <Command shouldFilter={false} loop value={commandValue} onValueChange={setCommandValue}>
            <CommandInput
              placeholder="Search records..."
              value={inputValue}
              onValueChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
            />
            <CommandList className="max-h-[75vh]">
              <CommandItem value="-" className="hidden" />
              <CommandEmpty>
                {!shouldSearch
                  ? 'Type to search...'
                  : !isFetching && !hasResults
                    ? 'No results found.'
                    : ''}
              </CommandEmpty>

              {shouldSearch && (
                <CommandGroup heading="Search Results">
                  {isFetching ? (
                    <CommandItem disabled className="flex items-center justify-center">
                      <Spinner className="size-4" />
                    </CommandItem>
                  ) : (
                    results.map((record) => (
                      <CommandItem
                        key={record.id}
                        value={`${record.title || 'Untitled'}--${record.id}`}
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
                disabled={inputValue.length === 0 || isFetching}
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
