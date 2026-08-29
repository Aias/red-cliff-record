import type { RecordType } from '@hozo';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon, CrosshairIcon, TrendingUpIcon, XIcon } from 'lucide-react';
import { useState, type ElementType } from 'react';
import { z } from 'zod';
import { useTRPC } from '@/app/trpc';
import { Button } from '@/components/button';
import { Command } from '@/components/command';
import { Dialog } from '@/components/dialog';
import { DropdownMenu } from '@/components/dropdown-menu';
import { Spinner } from '@/components/spinner';
import { ToggleGroup } from '@/components/toggle-group';
import { Tooltip } from '@/components/tooltip';
import { useRecord } from '@/lib/hooks/record-queries';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { DbId } from '@/shared/types/api';
import { styled } from '@/styled-system/jsx';
import { getRecordTitle } from '../../records/-components/record-parts';
import { SearchResultItem } from '../../records/-components/search-result-item';
import { recordTypeIcons } from '../../records/-components/type-icons';

const ARENA_TYPES: { value: RecordType; label: string; icon: ElementType }[] = [
  { value: 'artifact', label: 'Artifacts', icon: recordTypeIcons.artifact.icon },
  { value: 'concept', label: 'Concepts', icon: recordTypeIcons.concept.icon },
  { value: 'entity', label: 'Entities', icon: recordTypeIcons.entity.icon },
];

/**
 * Score floors for matchup selection. Scores are percentile-mapped onto an
 * Elo scale centered at 1200 with roughly a 150-point spread, so these rungs
 * step from the top quarter to the top few percent of the pool.
 */
const MIN_SCORE_OPTIONS = [1300, 1400, 1500, 1600];

const MinScoreSchema = z.number().int().positive();

export function ArenaControls({
  type,
  focus,
  minScore,
}: {
  type: RecordType;
  focus?: DbId;
  minScore?: number;
}) {
  const navigate = useNavigate({ from: '/arena' });
  const [searchOpen, setSearchOpen] = useState(false);

  const handleTypeChange = (value: RecordType[]) => {
    const next = value[0];
    if (next && next !== type) {
      void navigate({ search: { type: next, minScore } });
    }
  };

  const handleFocusSelect = (id: DbId) => {
    setSearchOpen(false);
    void navigate({ search: (prev) => ({ ...prev, focus: id }) });
  };

  const handleMinScoreChange = (value: unknown) => {
    const parsed = MinScoreSchema.safeParse(value);
    void navigate({
      search: (prev) => ({ ...prev, minScore: parsed.success ? parsed.data : undefined }),
    });
  };

  const clearFocus = () => {
    void navigate({ search: { type, minScore } });
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

      <DropdownMenu.Root>
        <Button variant="outline" render={<DropdownMenu.Trigger />}>
          <TrendingUpIcon />
          {minScore !== undefined ? `${minScore}+` : 'Any score'}
          <ChevronDownIcon />
        </Button>
        <DropdownMenu.Content align="start" css={{ width: '40' }}>
          <DropdownMenu.RadioGroup value={minScore ?? 0} onValueChange={handleMinScoreChange}>
            <DropdownMenu.RadioItem value={0}>Any score</DropdownMenu.RadioItem>
            {MIN_SCORE_OPTIONS.map((score) => (
              <DropdownMenu.RadioItem key={score} value={score}>
                {score}+
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        {focus !== undefined ? (
          <FocusedRecordChip focus={focus} onClear={clearFocus} />
        ) : (
          <Dialog.Trigger
            render={
              <Button variant="outline">
                <CrosshairIcon />
                Focus a record…
              </Button>
            }
          />
        )}
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
    </styled.header>
  );
}

function FocusedRecordChip({ focus, onClear }: { focus: DbId; onClear: () => void }) {
  const { data: record } = useRecord(focus);
  return (
    <styled.div css={{ display: 'flex', maxWidth: '96' }}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Dialog.Trigger
              render={
                <Button
                  variant="solid"
                  css={{ minWidth: '0', borderStartEndRadius: 'none', borderEndEndRadius: 'none' }}
                >
                  <CrosshairIcon />
                  <styled.span css={{ minWidth: '0', truncate: true }}>
                    {record ? getRecordTitle(record) : `Record ${focus}`}
                  </styled.span>
                </Button>
              }
            />
          }
        />
        <Tooltip.Content>Focus a different record</Tooltip.Content>
      </Tooltip.Root>
      <Button
        variant="solid"
        size="icon"
        aria-label="Stop focusing"
        onClick={onClear}
        css={{
          borderStartStartRadius: 'none',
          borderEndStartRadius: 'none',
          borderInlineStartColor: 'mainContrast/20',
        }}
      >
        <XIcon />
      </Button>
    </styled.div>
  );
}

function FocusSearch({ type, onSelect }: { type: RecordType; onSelect: (id: DbId) => void }) {
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 200);
  const shouldSearch = debouncedQuery.length >= 1;

  const results = useQuery(
    trpc.records.list.queryOptions(
      {
        searchQuery: debouncedQuery,
        strategy: 'lexical',
        filters: { types: [type], isCurated: true },
        limit: 8,
      },
      { enabled: shouldSearch }
    )
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
