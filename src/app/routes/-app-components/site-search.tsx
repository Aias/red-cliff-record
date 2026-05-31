import { useNavigate, useRouterState } from '@tanstack/react-router';
import { PlusCircleIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/app/trpc';
import { Button } from '@/components/button';
import { Command } from '@/components/command';
import { Popover } from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
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

  const trigram = trpc.records.list.useQuery(
    { searchQuery: debouncedQuery, strategy: 'trigram', limit: 10 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );
  const vector = trpc.records.list.useQuery(
    { searchQuery: debouncedQuery, strategy: 'vector', limit: 10 },
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
    <Popover.Root
      open={commandOpen}
      onOpenChange={(open) => {
        setCommandOpen(open);
        if (open && searchQ) setInputValue(searchQ);
      }}
    >
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            css={{
              containerType: 'inline-size',
              position: 'relative',
              width: 'full',
              minWidth: '0',
              justifyContent: 'flex-start',
              gap: '3',
              contain: 'inline-size',
              fontWeight: 'normal',
              color: 'primary',
              boxShadow: 'none',
              _childIcon: {
                color: 'muted',
              },
            }}
            role="combobox"
            aria-expanded={commandOpen}
          >
            <SearchIcon className={css({ '@container (max-width: 10rem)': { srOnly: true } })} />
            <styled.span css={{ minWidth: '0', flex: '1', truncate: true, textAlign: 'start' }}>
              {searchQ || 'Search records...'}
            </styled.span>
            <styled.kbd
              css={{
                pointerEvents: 'none',
                marginInlineStart: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5',
                borderRadius: 'md',
                border: 'border',
                backgroundColor: 'splash',
                paddingInline: '1.5',
                fontFamily: 'mono',
                fontWeight: 'medium',
                color: 'accent',
                userSelect: 'none',
                '@container (max-width: 14rem)': { srOnly: true },
              }}
            >
              <styled.span css={{ textStyle: 'xs', color: 'muted' }}>⌘</styled.span>K
            </styled.kbd>
          </Button>
        }
      />
      <Popover.Content
        css={{
          width: '160',
          maxWidth: '[calc({sizes.screenW} - 1rem)]',
          overflow: 'auto',
          padding: '0',
        }}
        align="center"
        collisionPadding={8}
        sideOffset={16}
      >
        <Command.Root
          shouldFilter={false}
          loop
          value={commandValue}
          onValueChange={setCommandValue}
        >
          <Command.Input
            placeholder="Search records..."
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
          />
          <Command.List css={{ maxHeight: '[75vh]' }}>
            <Command.Item value="-" css={{ display: 'none' }} />
            <Command.Empty>
              {!shouldSearch
                ? 'Type to search...'
                : isSearching
                  ? ''
                  : !hasResults
                    ? 'No results found.'
                    : ''}
            </Command.Empty>

            {shouldSearch && isSearching && (
              <Command.Item
                disabled
                css={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Spinner css={{ boxSize: '4' }} />
              </Command.Item>
            )}

            {trigramResults.length > 0 && (
              <Command.Group heading="Text Matches">
                {trigramResults.map(({ id }) => (
                  <Command.Item key={id} value={String(id)} onSelect={() => handleSelectResult(id)}>
                    <SearchResultItem id={id} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {vectorResults.length > 0 && (
              <Command.Group heading="Similar">
                {vectorResults.map(({ id }) => (
                  <Command.Item key={id} value={String(id)} onSelect={() => handleSelectResult(id)}>
                    <SearchResultItem id={id} />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {vector.isFetching && !vector.data && trigramResults.length > 0 && (
              <Command.Item
                disabled
                css={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Spinner css={{ boxSize: '4' }} />
              </Command.Item>
            )}

            {shouldSearch && <Command.Separator alwaysRender />}

            <Command.Item
              disabled={inputValue.length === 0 || trigram.isFetching}
              key="create-record"
              onSelect={() => {
                createRecordMutation.mutate(
                  { type: 'artifact', title: inputValue },
                  { onSuccess: (newRecord) => handleSelectResult(newRecord.id) }
                );
              }}
              css={{ paddingInline: '3', paddingBlock: '2' }}
            >
              <PlusCircleIcon /> Create New Record
            </Command.Item>
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  );
};
