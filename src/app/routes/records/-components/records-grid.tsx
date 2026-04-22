import { IntegrationTypeSchema, type IntegrationType } from '@hozo/schema/operations.shared';
import { RecordTypeSchema, type RecordType } from '@hozo/schema/records.shared';
import { Link } from '@tanstack/react-router';
import { ChevronDownIcon, ShoppingBasketIcon } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/app/trpc';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/dropdown-menu';
import { ExternalLink } from '@/components/external-link';
import { Input } from '@/components/input';
import { IntegrationLogo } from '@/components/integration-logo';
import { Label } from '@/components/label';
import { Placeholder } from '@/components/placeholder';
import { Spinner } from '@/components/spinner';
import { Table } from '@/components/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/toggle-group';
import { Tooltip } from '@/components/tooltip';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import type { DbId } from '@/shared/types/api';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { SourceLogos } from './record-parts';
import { recordTypeIcons, RecordTypeIcon } from './type-icons';

function formatDate(dateValue: Date | string) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  return `${date.toLocaleDateString()} ${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function RecordRow({ recordId }: { recordId: DbId }) {
  const { data: record } = useRecord(recordId);
  const inBasket = useInBasket(recordId);

  if (!record) {
    return (
      <Table.Row>
        <Table.Cell colSpan={6}>
          <styled.div
            css={{
              width: '48',
              height: '4',
              borderRadius: 'md',
              backgroundColor: 'mist',
              animationName: 'pulse',
              animationDuration: '[2s]',
              animationTimingFunction: '[cubic-bezier(0.4,0,0.6,1)]',
              animationIterationCount: 'infinite',
            }}
          />
        </Table.Cell>
      </Table.Row>
    );
  }

  const { creatorTitle, parentTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  const label =
    record.title || record.summary || record.content || creatorTitle || parentTitle || 'Untitled';

  return (
    <Table.Row>
      <Table.Cell css={{ textAlign: 'center', textStyle: 'sm', color: 'symbol' }}>
        <RecordTypeIcon type={record.type} />
      </Table.Cell>
      <Table.Cell css={{ maxWidth: '60', whiteSpace: 'nowrap', truncate: true }}>
        <Tooltip.Root delayDuration={1000} disableHoverableContent>
          <Tooltip.Trigger asChild>
            <Link
              to="/records/$recordId"
              params={{ recordId: record.id }}
              className={css({
                display: 'flex',
                width: 'full',
                alignItems: 'center',
                gap: '2',
                truncate: true,
              })}
            >
              <styled.span css={{ truncate: true }}>{label}</styled.span>
              {record.abbreviation && (
                <styled.span css={{ flexShrink: '0', color: 'muted' }}>
                  ({record.abbreviation})
                </styled.span>
              )}
              {record.sense && (
                <styled.span css={{ flexShrink: '0', color: 'muted', fontStyle: 'italic' }}>
                  {record.sense}
                </styled.span>
              )}
              {inBasket && <ShoppingBasketIcon className={css({ color: 'accent' })} />}
            </Link>
          </Tooltip.Trigger>
          <Tooltip.Content className={css({ maxWidth: '96' })}>
            <styled.div css={{ lineClamp: '3' }}>{label}</styled.div>
          </Tooltip.Content>
        </Tooltip.Root>
      </Table.Cell>
      <Table.Cell css={{ whiteSpace: 'nowrap' }}>
        {record.url ? (
          <ExternalLink href={record.url}>{new URL(record.url).hostname}</ExternalLink>
        ) : (
          ''
        )}
      </Table.Cell>
      <Table.Cell css={{ textStyle: 'sm', whiteSpace: 'nowrap' }}>
        {record.recordCreatedAt ? formatDate(record.recordCreatedAt) : ''}
      </Table.Cell>
      <Table.Cell
        css={{
          textAlign: 'end',
          textStyle: 'sm',
          color: 'muted',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {record.eloScore !== 1200 && record.eloScore}
      </Table.Cell>
      <Table.Cell css={{ textAlign: 'center' }}>
        <SourceLogos
          sources={record.sources}
          className={css({ justifyContent: 'center', textStyle: 'sm' })}
        />
      </Table.Cell>
    </Table.Row>
  );
}

export const RecordsGrid = () => {
  const { state, setFilters, setLimit, reset } = useRecordFilters();
  const { data } = trpc.records.list.useQuery(
    { ...state, offset: 0 },
    { placeholderData: (prev) => prev }
  );

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
    (field: 'isCurated' | 'isPrivate' | 'hasParent' | 'hasMedia') => (value: string) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value === 'All' ? undefined : value === 'Yes',
      }));
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

  return data ? (
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
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="types">Types</Label>
          <DropdownMenu>
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
              render={<DropdownMenuTrigger id="types" />}
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
            <DropdownMenuContent align="start" className={css({ width: '48' })}>
              {RecordTypeSchema.options.map((recordType) => {
                const isSelected = types?.includes(recordType) ?? false;
                const { icon: Icon } = recordTypeIcons[recordType];
                return (
                  <DropdownMenuItem
                    key={recordType}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleTypeToggle(recordType);
                    }}
                  >
                    <Icon />
                    <styled.span css={{ flex: '1', textTransform: 'capitalize' }}>
                      {recordType}
                    </styled.span>
                    <Checkbox checked={isSelected} />
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="sources">Sources</Label>
          <DropdownMenu>
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
              render={<DropdownMenuTrigger id="sources" />}
            >
              <styled.span
                data-placeholder={!sources?.length || undefined}
                css={{ '&[data-placeholder]': { color: 'secondary' } }}
              >
                {sources?.length
                  ? sources.length ===
                    ['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter'].length
                    ? 'All Sources'
                    : `${sources.length} selected`
                  : 'All Sources'}
              </styled.span>
              <ChevronDownIcon />
            </Button>
            <DropdownMenuContent align="start" className={css({ width: '48' })}>
              {IntegrationTypeSchema.options
                .filter((s) =>
                  ['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter'].includes(s)
                )
                .map((source) => {
                  const isSelected = sources?.includes(source) ?? false;
                  return (
                    <DropdownMenuItem
                      key={source}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleSourceToggle(source);
                      }}
                    >
                      <IntegrationLogo
                        integration={source}
                        className={css({
                          display: 'grid',
                          boxSize: '4',
                          placeItems: 'center',
                        })}
                      />
                      <styled.span css={{ flex: '1', textTransform: 'capitalize' }}>
                        {source}
                      </styled.span>
                      <Checkbox checked={isSelected} />
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="curated">Is Curated?</Label>
          <ToggleGroup
            id="curated"
            type="single"
            value={curatedValue}
            onValueChange={toggleBooleanFilter('isCurated')}
            variant="outline"
            className={css({ width: 'full' })}
          >
            <ToggleGroupItem value="All" className={css({ flex: '1' })}>
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className={css({ flex: '1' })}>
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className={css({ flex: '1' })}>
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="hasParent">Has Parent?</Label>
          <ToggleGroup
            id="hasParent"
            type="single"
            value={hasParentValue}
            onValueChange={toggleBooleanFilter('hasParent')}
            variant="outline"
            className={css({ width: 'full' })}
          >
            <ToggleGroupItem value="All" className={css({ flex: '1' })}>
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className={css({ flex: '1' })}>
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className={css({ flex: '1' })}>
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="hasMedia">Has Media?</Label>
          <ToggleGroup
            id="hasMedia"
            type="single"
            value={hasMediaValue}
            onValueChange={toggleBooleanFilter('hasMedia')}
            variant="outline"
            className={css({ width: 'full' })}
          >
            <ToggleGroupItem value="All" className={css({ flex: '1' })}>
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className={css({ flex: '1' })}>
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className={css({ flex: '1' })}>
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </styled.div>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '1.5' }}>
          <Label htmlFor="private">Is Private?</Label>
          <ToggleGroup
            id="private"
            type="single"
            value={privateValue}
            onValueChange={toggleBooleanFilter('isPrivate')}
            variant="outline"
            className={css({ width: 'full' })}
          >
            <ToggleGroupItem value="All" className={css({ flex: '1' })}>
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className={css({ flex: '1' })}>
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className={css({ flex: '1' })}>
              No
            </ToggleGroupItem>
          </ToggleGroup>
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
      <Table.Root
        data-empty={data.ids.length === 0}
        css={{
          display: 'flex',
          flexDirection: 'column',
          height: 'full',
          flexBasis: 'full',
          overflow: 'auto',
          borderRadius: 'md',
          borderWidth: '1px',
          borderColor: 'divider',
          backgroundColor: 'surface',
          textStyle: 'sm',
          '&[data-empty="true"]': {
            height: 'full',
          },
        }}
      >
        <Table.Table>
          <Table.Header
            css={{
              position: 'sticky',
              top: '0',
              zIndex: '10',
              backgroundColor: 'container',
              _before: {
                content: '""',
                position: 'absolute',
                insetInline: '0',
                insetBlockEnd: '0',
                height: '[0.5px]',
                backgroundColor: 'divider',
              },
            }}
          >
            <Table.Row>
              <Table.Head css={{ srOnly: true, textAlign: 'center' }}>Type</Table.Head>
              <Table.Head>Record</Table.Head>
              <Table.Head>URL</Table.Head>
              <Table.Head>Created</Table.Head>
              <Table.Head css={{ width: '16', textAlign: 'end' }}>ELO</Table.Head>
              <Table.Head css={{ textAlign: 'center' }}>Sources</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.ids.length > 0 ? (
              data.ids.map(({ id }) => <RecordRow key={id} recordId={id} />)
            ) : (
              <Table.Row>
                <Table.Cell colSpan={6} css={{ pointerEvents: 'none', textAlign: 'center' }}>
                  No records found
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Table>
      </Table.Root>
    </styled.div>
  ) : (
    <Placeholder css={{ flexGrow: '1' }}>
      <Spinner />
    </Placeholder>
  );
};
