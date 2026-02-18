import { IntegrationTypeSchema, type IntegrationType } from '@hozo/schema/operations.shared';
import { RecordTypeSchema, type RecordType } from '@hozo/schema/records.shared';
import { Link } from '@tanstack/react-router';
import { ChevronDownIcon, ShoppingBasketIcon, StarIcon } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip';
import { useInBasket } from '@/lib/hooks/use-basket';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
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
      <TableRow>
        <TableCell colSpan={5}>
          <div className="h-4 w-48 animate-pulse rounded bg-c-mist" />
        </TableCell>
      </TableRow>
    );
  }

  const { creatorTitle, parentTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  const label =
    record.title || creatorTitle || parentTitle || record.summary || record.content || 'Untitled';

  return (
    <TableRow>
      <TableCell className="text-center text-sm">
        <RecordTypeIcon type={record.type} />
      </TableCell>
      <TableCell className="max-w-60 truncate whitespace-nowrap">
        <Tooltip delayDuration={1000} disableHoverableContent>
          <TooltipTrigger asChild>
            <Link
              to="/records/$recordId"
              params={{ recordId: record.id }}
              className="flex w-full items-center gap-2 truncate"
            >
              <span className="truncate">{label}</span>
              {record.abbreviation && (
                <span className="shrink-0 text-c-hint">({record.abbreviation})</span>
              )}
              {record.sense && <span className="shrink-0 text-c-hint italic">{record.sense}</span>}
              {record.rating >= 1 && (
                <ol
                  className="flex shrink-0 gap-0.5 opacity-75"
                  aria-label={`${record.rating} star rating`}
                >
                  {Array.from({ length: record.rating }, (_, i) => (
                    <li key={i}>
                      <StarIcon className="size-[0.875em] fill-current" />
                    </li>
                  ))}
                </ol>
              )}
              {inBasket && (
                <ShoppingBasketIcon className="size-[0.875em] shrink-0 text-c-accent" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent className="max-w-96">
            <div className="line-clamp-3">{label}</div>
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {record.url ? (
          <ExternalLink href={record.url}>{new URL(record.url).hostname}</ExternalLink>
        ) : (
          ''
        )}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {record.recordCreatedAt ? formatDate(record.recordCreatedAt) : ''}
      </TableCell>
      <TableCell className="text-center">
        <SourceLogos sources={record.sources} className="justify-center text-sm" />
      </TableCell>
    </TableRow>
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
    <div className="flex h-full grow gap-4 overflow-hidden">
      <div className="-mx-4 flex min-w-48 flex-col gap-3 overflow-y-auto px-4 text-sm">
        <h3 className="mb-1 text-base">Record Filters</h3>
        <hr />
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={reset} className="text-start hover:underline">
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => setFilters({ isCurated: false, hasParent: false })}
            className="text-start hover:underline"
          >
            Curation Queue
          </button>
        </div>
        <hr />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="types">Types</Label>
          <DropdownMenu>
            <Button variant="outline" className="w-full justify-between" asChild>
              <DropdownMenuTrigger id="types">
                <span className={types?.length ? '' : 'text-c-secondary'}>
                  {types?.length
                    ? types.length === RecordTypeSchema.options.length
                      ? 'All Types'
                      : `${types.length} selected`
                    : 'All Types'}
                </span>
                <ChevronDownIcon className="size-4 opacity-50" />
              </DropdownMenuTrigger>
            </Button>
            <DropdownMenuContent align="start" className="w-48">
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
                    <span className="flex-1 capitalize">{recordType}</span>
                    <Checkbox checked={isSelected} />
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sources">Sources</Label>
          <DropdownMenu>
            <Button variant="outline" className="w-full justify-between" asChild>
              <DropdownMenuTrigger id="sources">
                <span className={sources?.length ? '' : 'text-c-secondary'}>
                  {sources?.length
                    ? sources.length ===
                      ['airtable', 'github', 'lightroom', 'raindrop', 'readwise', 'twitter'].length
                      ? 'All Sources'
                      : `${sources.length} selected`
                    : 'All Sources'}
                </span>
                <ChevronDownIcon className="size-4 opacity-50" />
              </DropdownMenuTrigger>
            </Button>
            <DropdownMenuContent align="start" className="w-48">
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
                        className="grid size-4 place-items-center"
                      />
                      <span className="flex-1 capitalize">{source}</span>
                      <Checkbox checked={isSelected} />
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="curated">Is Curated?</Label>
          <ToggleGroup
            id="curated"
            type="single"
            value={curatedValue}
            onValueChange={toggleBooleanFilter('isCurated')}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="All" className="flex-1">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className="flex-1">
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className="flex-1">
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasParent">Has Parent?</Label>
          <ToggleGroup
            id="hasParent"
            type="single"
            value={hasParentValue}
            onValueChange={toggleBooleanFilter('hasParent')}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="All" className="flex-1">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className="flex-1">
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className="flex-1">
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasMedia">Has Media?</Label>
          <ToggleGroup
            id="hasMedia"
            type="single"
            value={hasMediaValue}
            onValueChange={toggleBooleanFilter('hasMedia')}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="All" className="flex-1">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className="flex-1">
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className="flex-1">
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="private">Is Private?</Label>
          <ToggleGroup
            id="private"
            type="single"
            value={privateValue}
            onValueChange={toggleBooleanFilter('isPrivate')}
            variant="outline"
            className="w-full"
          >
            <ToggleGroupItem value="All" className="flex-1">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="Yes" className="flex-1">
              Yes
            </ToggleGroupItem>
            <ToggleGroupItem value="No" className="flex-1">
              No
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="limit">Results Limit</Label>
          <Input
            id="limit"
            type="number"
            min="1"
            placeholder="Number of results"
            value={limitInput}
            onChange={handleLimitChange}
          />
        </div>
      </div>
      <div className="flex grow overflow-hidden rounded border border-c-divider bg-c-page text-xs">
        <Table className={cn({ 'h-full': data.ids.length === 0 })}>
          <TableHeader className="sticky top-0 z-10 bg-c-page before:absolute before:right-0 before:bottom-0 before:left-0 before:h-[0.5px] before:bg-c-divider">
            <TableRow className="sticky top-0 z-10 bg-c-mist">
              <TableHead className="sr-only text-center">Type</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-center">Sources</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.ids.length > 0 ? (
              data.ids.map(({ id }) => <RecordRow key={id} recordId={id} />)
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="pointer-events-none text-center">
                  No records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  ) : (
    <Placeholder className="grow">
      <Spinner />
    </Placeholder>
  );
};
