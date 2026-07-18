import type { RecordType } from '@hozo';
import { useNavigate } from '@tanstack/react-router';
import { CrosshairIcon, XIcon } from 'lucide-react';
import { useState, type ElementType } from 'react';
import { trpc } from '@/app/trpc';
import { Button } from '@/components/button';
import { Command } from '@/components/command';
import { Dialog } from '@/components/dialog';
import { Spinner } from '@/components/spinner';
import { ToggleGroup } from '@/components/toggle-group';
import { Tooltip } from '@/components/tooltip';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { DbId } from '@/shared/types/api';
import { styled } from '@/styled-system/jsx';
import { RecordLink } from '../../records/-components/record-link';
import { SearchResultItem } from '../../records/-components/search-result-item';
import { recordTypeIcons } from '../../records/-components/type-icons';

const ARENA_TYPES: { value: RecordType; label: string; icon: ElementType }[] = [
  { value: 'artifact', label: 'Artifacts', icon: recordTypeIcons.artifact.icon },
  { value: 'concept', label: 'Concepts', icon: recordTypeIcons.concept.icon },
  { value: 'entity', label: 'Entities', icon: recordTypeIcons.entity.icon },
];

export function ArenaControls({ type, focus }: { type: RecordType; focus?: DbId }) {
  const navigate = useNavigate({ from: '/arena' });
  const [searchOpen, setSearchOpen] = useState(false);

  const handleTypeChange = (value: RecordType[]) => {
    const next = value[0];
    if (next && next !== type) {
      void navigate({ search: { type: next } });
    }
  };

  const handleFocusSelect = (id: DbId) => {
    setSearchOpen(false);
    void navigate({ search: { type, focus: id } });
  };

  const clearFocus = () => {
    void navigate({ search: { type } });
  };

  return (
    <styled.header
      css={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3',
      }}
    >
      <ToggleGroup.Root
        variant="outline"
        css={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '[1fr]' }}
        value={[type]}
        onValueChange={handleTypeChange}
      >
        {ARENA_TYPES.map(({ value, label, icon: Icon }) => (
          <Tooltip.Root key={value}>
            <Tooltip.Trigger
              render={
                <ToggleGroup.Item value={value} aria-label={label}>
                  <Icon />
                  {label}
                </ToggleGroup.Item>
              }
            />
            <Tooltip.Content>{recordTypeIcons[value].description}</Tooltip.Content>
          </Tooltip.Root>
        ))}
      </ToggleGroup.Root>

      {focus ? (
        <styled.div
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            maxWidth: '96',
            borderRadius: 'md',
            border: 'border',
            backgroundColor: 'splash',
            paddingInlineStart: '3',
            paddingInlineEnd: '1',
            paddingBlock: '1',
            textStyle: 'sm',
            _childIcon: { flexShrink: '0', color: 'accent' },
          }}
        >
          <CrosshairIcon />
          <RecordLink
            id={focus}
            linkOptions={{ to: '/records/$recordId', params: { recordId: focus } }}
          />
          <Button variant="ghost" size="icon" aria-label="Stop focusing" onClick={clearFocus}>
            <XIcon />
          </Button>
        </styled.div>
      ) : (
        <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
          <Dialog.Trigger
            render={
              <Button variant="outline">
                <CrosshairIcon />
                Focus a record…
              </Button>
            }
          />
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Focus a record</Dialog.Title>
              <Dialog.Description>
                Lock one side of the arena to rank a single record against the field.
              </Dialog.Description>
            </Dialog.Header>
            <FocusSearch type={type} onSelect={handleFocusSelect} />
          </Dialog.Content>
        </Dialog.Root>
      )}
    </styled.header>
  );
}

function FocusSearch({ type, onSelect }: { type: RecordType; onSelect: (id: DbId) => void }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const shouldSearch = debouncedQuery.length >= 1;

  const results = trpc.records.list.useQuery(
    {
      searchQuery: debouncedQuery,
      strategy: 'lexical',
      filters: { types: [type], isCurated: true },
      limit: 8,
    },
    { enabled: shouldSearch }
  );
  const ids = results.data?.ids ?? [];

  return (
    <Command.Root shouldFilter={false} loop css={{ width: 'full' }} defaultValue="">
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Find a curated record…"
      />
      <Command.List>
        <Command.Item value="-" css={{ display: 'none' }} />
        {shouldSearch && results.isFetching && !results.data && (
          <Command.Item
            disabled
            css={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Spinner css={{ boxSize: '4' }} />
          </Command.Item>
        )}
        {ids.map(({ id }) => (
          <Command.Item key={id} value={String(id)} onSelect={() => onSelect(id)}>
            <SearchResultItem id={id} />
          </Command.Item>
        ))}
        {shouldSearch && !results.isFetching && ids.length === 0 && (
          <Command.Item disabled>No results</Command.Item>
        )}
      </Command.List>
    </Command.Root>
  );
}
