import { IntegrationTypeSchema, type IntegrationType } from '@hozo/schema/operations.shared';
import { RecordTypeSchema, type RecordType } from '@hozo/schema/records.shared';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/button';
import { DropdownMenu } from '@/components/dropdown-menu';
import { Input } from '@/components/input';
import { IntegrationLogo } from '@/components/integration-logo';
import { Label } from '@/components/label';
import { Placeholder } from '@/components/placeholder';
import { RadioCards, RadioCardsItem } from '@/components/radio-cards';
import { Spinner } from '@/components/spinner';
import { ToggleGroup } from '@/components/toggle-group';
import { useRecordList } from '@/lib/hooks/record-queries';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { RecordLink } from './record-link';
import { SortMenu } from './sort-menu';
import { recordTypeIcons } from './type-icons';

export const RecordsIndex = () => {
  const navigate = useNavigate();
  const { state, setFilters, setLimit, reset } = useRecordFilters();
  const { ids: recordIds, isLoading } = useRecordList(state);

  const {
    filters: { types, isCurated, isPrivate, sources, hasParent, hasMedia },
    limit,
  } = state;

  const [limitInput, setLimitInput] = useState(limit?.toString() ?? '');

  const curatedValue = isCurated === undefined ? 'All' : isCurated ? 'Yes' : 'No';
  const privateValue = isPrivate === undefined ? 'All' : isPrivate ? 'Yes' : 'No';
  const hasParentValue = hasParent === undefined ? 'All' : hasParent ? 'Yes' : 'No';
  const hasMediaValue = hasMedia === undefined ? 'All' : hasMedia ? 'Yes' : 'No';

  const handleTypeToggle = (recordType: RecordType) => {
    setFilters((prev) => {
      const currentTypes = prev.types ?? [];
      const newTypes = currentTypes.includes(recordType)
        ? currentTypes.filter((t) => t !== recordType)
        : [...currentTypes, recordType];
      return { ...prev, types: newTypes.length > 0 ? newTypes : undefined };
    });
  };

  const handleSourceToggle = (source: IntegrationType) => {
    setFilters((prev) => {
      const currentSources = prev.sources ?? [];
      const newSources = currentSources.includes(source)
        ? currentSources.filter((s) => s !== source)
        : [...currentSources, source];
      return { ...prev, sources: newSources.length > 0 ? newSources : undefined };
    });
  };

  const toggleBooleanFilter =
    (field: 'isCurated' | 'isPrivate' | 'hasParent' | 'hasMedia') => (groupValue: string[]) => {
      const value = groupValue[0] ?? 'All';
      setFilters((prev) => ({
        ...prev,
        [field]: value === 'All' ? undefined : value === 'Yes',
      }));
    };

  const handleValueChange = (value: string) => {
    void navigate({
      to: '/records/$recordId',
      params: { recordId: Number(value) },
    });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setLimitInput(value);
      if (value) {
        setLimit(parseInt(value, 10));
      }
    }
  };

  if (isLoading)
    return (
      <Placeholder css={{ flexGrow: '1', margin: '4' }}>
        <Spinner />
      </Placeholder>
    );

  return (
    <styled.div
      css={{
        display: 'flex',
        height: 'full',
        flexGrow: '1',
        gap: '4',
        overflow: 'hidden',
      }}
    >
      <styled.div
        css={{
          marginInline: '-4',
          display: 'flex',
          minWidth: '48',
          flexDirection: 'column',
          gap: '3',
          overflowY: 'auto',
          paddingInline: '4',
          textStyle: 'sm',
          '@container (max-width: 40rem)': { display: 'none' },
        }}
      >
        <styled.h3 css={{ marginBlockEnd: '1', textStyle: 'base' }}>Record Filters</styled.h3>
        <hr />
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <styled.button
            type="button"
            onClick={reset}
            css={{ textAlign: 'start', _hover: { textDecoration: 'underline' } }}
          >
            Reset to Defaults
          </styled.button>
          <styled.button
            type="button"
            onClick={() => setFilters({ isCurated: false, hasParent: false })}
            css={{ textAlign: 'start', _hover: { textDecoration: 'underline' } }}
          >
            Curation Queue
          </styled.button>
        </styled.div>
        <hr />
        <SortMenu />
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="types">Types</Label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              id="types"
              render={
                <Button
                  variant="outline"
                  css={{
                    width: 'full',
                    justifyContent: 'space-between',
                    _childIcon: {
                      boxSize: '4',
                      opacity: '50%',
                    },
                  }}
                >
                  <styled.span
                    data-placeholder={!types?.length || undefined}
                    css={{ '&[data-placeholder]': { color: 'secondary' } }}
                  >
                    {types?.length
                      ? types.length === RecordTypeSchema.options.length
                        ? 'All Types'
                        : `${types.length} selected`
                      : 'All Types'}
                  </styled.span>
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenu.Content align="start" css={{ width: '48' }}>
              {RecordTypeSchema.options.map((recordType) => {
                const isSelected = types?.includes(recordType) ?? false;
                const { icon: Icon } = recordTypeIcons[recordType];
                return (
                  <DropdownMenu.CheckboxItem
                    key={recordType}
                    checked={isSelected}
                    onCheckedChange={() => handleTypeToggle(recordType)}
                  >
                    <styled.span css={{ flex: '1', textTransform: 'capitalize' }}>
                      {recordType}
                    </styled.span>
                    <Icon className={css({ boxSize: '4', flexShrink: '0', color: 'muted' })} />
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="sources">Sources</Label>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              id="sources"
              render={
                <Button
                  variant="outline"
                  css={{
                    width: 'full',
                    justifyContent: 'space-between',
                    _childIcon: {
                      boxSize: '4',
                      opacity: '50%',
                    },
                  }}
                >
                  <styled.span
                    data-placeholder={!sources?.length || undefined}
                    css={{ '&[data-placeholder]': { color: 'secondary' } }}
                  >
                    {sources?.length
                      ? sources.length ===
                        ['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter']
                          .length
                        ? 'All Sources'
                        : `${sources.length} selected`
                      : 'All Sources'}
                  </styled.span>
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenu.Content align="start" css={{ width: '48' }}>
              {IntegrationTypeSchema.options
                .filter((s) =>
                  ['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter'].includes(s)
                )
                .map((source) => {
                  const isSelected = sources?.includes(source) ?? false;
                  return (
                    <DropdownMenu.CheckboxItem
                      key={source}
                      checked={isSelected}
                      onCheckedChange={() => handleSourceToggle(source)}
                    >
                      <styled.span css={{ flex: '1', textTransform: 'capitalize' }}>
                        {source}
                      </styled.span>
                      <IntegrationLogo
                        integration={source}
                        css={{ boxSize: '4', flexShrink: '0' }}
                      />
                    </DropdownMenu.CheckboxItem>
                  );
                })}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="curated">Is Curated?</Label>
          <ToggleGroup.Root
            id="curated"
            value={[curatedValue]}
            onValueChange={toggleBooleanFilter('isCurated')}
            variant="outline"
            css={{ width: 'full' }}
          >
            <ToggleGroup.Item value="All">All</ToggleGroup.Item>
            <ToggleGroup.Item value="Yes">Yes</ToggleGroup.Item>
            <ToggleGroup.Item value="No">No</ToggleGroup.Item>
          </ToggleGroup.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="hasParent">Has Parent?</Label>
          <ToggleGroup.Root
            id="hasParent"
            value={[hasParentValue]}
            onValueChange={toggleBooleanFilter('hasParent')}
            variant="outline"
            css={{ width: 'full' }}
          >
            <ToggleGroup.Item value="All">All</ToggleGroup.Item>
            <ToggleGroup.Item value="Yes">Yes</ToggleGroup.Item>
            <ToggleGroup.Item value="No">No</ToggleGroup.Item>
          </ToggleGroup.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="hasMedia">Has Media?</Label>
          <ToggleGroup.Root
            id="hasMedia"
            value={[hasMediaValue]}
            onValueChange={toggleBooleanFilter('hasMedia')}
            variant="outline"
            css={{ width: 'full' }}
          >
            <ToggleGroup.Item value="All">All</ToggleGroup.Item>
            <ToggleGroup.Item value="Yes">Yes</ToggleGroup.Item>
            <ToggleGroup.Item value="No">No</ToggleGroup.Item>
          </ToggleGroup.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="private">Is Private?</Label>
          <ToggleGroup.Root
            id="private"
            value={[privateValue]}
            onValueChange={toggleBooleanFilter('isPrivate')}
            variant="outline"
            css={{ width: 'full' }}
          >
            <ToggleGroup.Item value="All">All</ToggleGroup.Item>
            <ToggleGroup.Item value="Yes">Yes</ToggleGroup.Item>
            <ToggleGroup.Item value="No">No</ToggleGroup.Item>
          </ToggleGroup.Root>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="limit">Results Limit</Label>
          <Input
            id="limit"
            type="number"
            min="1"
            placeholder="Number of results"
            value={limitInput}
            onChange={handleLimitChange}
          />
        </styled.div>
      </styled.div>
      {recordIds.length > 0 ? (
        <styled.div css={{ height: 'full', flexBasis: 'full', overflowY: 'auto' }}>
          <RadioCards
            aria-label="Records"
            onValueChange={handleValueChange}
            css={{
              columnWidth: '{sizes.80}',
              columnGap: '2',
              textStyle: 'xs',
            }}
          >
            {recordIds.map((id) => (
              <RadioCardsItem
                key={id}
                value={id.toString()}
                css={{ breakInside: 'avoid', marginBlockEnd: '2' }}
              >
                <RecordLink
                  id={id}
                  previewLines={3}
                  className={css({ width: 'full', overflow: 'hidden' })}
                />
              </RadioCardsItem>
            ))}
          </RadioCards>
        </styled.div>
      ) : (
        <Placeholder css={{ height: 'full', flexBasis: 'full' }}>No records found</Placeholder>
      )}
    </styled.div>
  );
};
