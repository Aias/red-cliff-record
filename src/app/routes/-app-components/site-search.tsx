import { useNavigate, useRouterState } from '@tanstack/react-router';
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
import { SearchResultItem } from '../records/-components/search-result-item';

const MIN_QUERY_LENGTH = 2;

export const SiteSearch = () => {
  const navigate = useNavigate();
  const searchQ = useRouterState({
    select: (s) =>
      s.location.pathname === '/search' ? (s.location.search as { q?: string }).q : undefined,
  });
  const [inputValue, setInputValue] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandValue, setCommandValue] = useState('');

  const createRecordMutation = useUpsertRecord();

  const debouncedQuery = useDebounce(inputValue, 300);
  const shouldSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const trigram = trpc.records.search.useQuery(
    { query: debouncedQuery, strategy: 'trigram', limit: 10 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );
  const vector = trpc.records.search.useQuery(
    { query: debouncedQuery, strategy: 'vector', limit: 10 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );

  const trigramResults = trigram.data?.ids ?? [];
  const trigramIds = new Set(trigramResults.map((r) => r.id));
  const vectorResults = (vector.data?.ids ?? []).filter((r) => !trigramIds.has(r.id));
  const hasResults = trigramResults.length > 0 || vectorResults.length > 0;
  const isSearching = trigram.isFetching && !trigram.data;

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
    void navigate({ to: '/search', search: { q: trimmed } });
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
    <Popover
      open={commandOpen}
      onOpenChange={(open) => {
        setCommandOpen(open);
        if (open && searchQ) setInputValue(searchQ);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative inline-flex w-full min-w-0 justify-start gap-3 rounded-md text-sm font-normal text-c-primary shadow-none"
          role="combobox"
          aria-expanded={commandOpen}
        >
          <SearchIcon className="text-c-hint" />
          <span className="min-w-0 flex-1 truncate text-start">
            {searchQ || 'Search records...'}
          </span>
          <kbd className="pointer-events-none ml-auto inline-flex items-center gap-1 rounded border border-c-border bg-c-mist px-1.5 font-mono font-medium text-c-secondary select-none">
            <span className="text-xs text-c-hint">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-150 overflow-auto p-0" align="center">
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
                : isSearching
                  ? ''
                  : !hasResults
                    ? 'No results found.'
                    : ''}
            </CommandEmpty>

            {shouldSearch && isSearching && (
              <CommandItem disabled className="flex items-center justify-center">
                <Spinner className="size-4" />
              </CommandItem>
            )}

            {trigramResults.length > 0 && (
              <CommandGroup heading="Text Matches">
                {trigramResults.map(({ id }) => (
                  <CommandItem key={id} value={String(id)} onSelect={() => handleSelectResult(id)}>
                    <SearchResultItem id={id} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {vectorResults.length > 0 && (
              <CommandGroup heading="Similar">
                {vectorResults.map(({ id }) => (
                  <CommandItem key={id} value={String(id)} onSelect={() => handleSelectResult(id)}>
                    <SearchResultItem id={id} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {vector.isFetching && !vector.data && trigramResults.length > 0 && (
              <CommandItem disabled className="flex items-center justify-center">
                <Spinner className="size-4" />
              </CommandItem>
            )}

            {shouldSearch && <CommandSeparator alwaysRender />}

            <CommandItem
              disabled={inputValue.length === 0 || trigram.isFetching}
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
  );
};
