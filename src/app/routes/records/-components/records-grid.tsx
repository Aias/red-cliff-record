import {
  IntegrationTypeSchema,
  RecordTypeSchema,
  type IntegrationType,
  type RecordType,
} from '@aias/hozo';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
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
import { useRecord } from '@/lib/hooks/record-queries';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types';
import { defaultQueueOptions } from '@/shared/types';
import { recordTypeIcons, RecordTypeIcon } from './type-icons';

const RecordRow = memo(function RecordRow({ id }: { id: DbId }) {
  const { data: record } = useRecord(id);

  if (!record) return null;

  const title = record.title || record.summary || record.content || 'Untitled Record';
  const ratingStars = record.rating && record.rating >= 1 ? '⭐'.repeat(record.rating) : '';

  return (
    <TableRow>
      <TableCell className="text-center text-sm">
        <RecordTypeIcon type={record.type} />
      </TableCell>
      <TableCell className="max-w-60 truncate whitespace-nowrap">
        <Tooltip delayDuration={1000}>
          <TooltipTrigger asChild>
            <Link
              to="/records/$recordId"
              params={{ recordId: record.id }}
              className="block w-full truncate"
            >
              {ratingStars && <span className="mr-2">{ratingStars}</span>}
              {title}
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <div
              className="line-clamp-3" // Line clamp only works on elements without block padding, otherwise the clipped text will show through on the padding area
            >
              {title}
            </div>
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
        {record.recordCreatedAt
          ? (() => {
              const date = new Date(record.recordCreatedAt);
              const hours24 = date.getHours();
              const minutes = date.getMinutes();
              const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
              const ampm = hours24 >= 12 ? 'PM' : 'AM';
              return `${date.toLocaleDateString()} ${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
            })()
          : ''}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex justify-center gap-1">
          {record.sources?.map((source) => (
            <IntegrationLogo integration={source} key={source} className="size-4" />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
});

export const RecordsGrid = () => {
  const search = useSearch({
    from: '/records',
  });
  const navigate = useNavigate({
    from: '/records',
  });
  const { data: queue } = trpc.records.list.useQuery(search);

  const {
    filters: { types, title, url, isCurated, isPrivate, sources, hasParent, text, hasMedia },
    limit,
  } = search;

  // Memoize filter values
  const filterValues = useMemo(
    () => ({
      curatedValue: isCurated === undefined ? 'All' : isCurated ? 'Yes' : 'No',
      privateValue: isPrivate === undefined ? 'All' : isPrivate ? 'Yes' : 'No',
      hasParentValue: hasParent === undefined ? 'All' : hasParent ? 'Yes' : 'No',
      hasMediaValue: hasMedia === undefined ? 'All' : hasMedia ? 'Yes' : 'No',
    }),
    [isCurated, isPrivate, hasParent, hasMedia]
  );

  // State for input fields
  const [titleInput, setTitleInput] = useState(title ?? '');
  const [urlInput, setUrlInput] = useState(url ?? '');
  const [textInput, setTextInput] = useState(text ?? '');
  const [limitInput, setLimitInput] = useState(limit?.toString() ?? '');

  // Debounced navigation handlers
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setTitleInput(value);
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            title: value || undefined,
          },
        }),
      });
    },
    [navigate]
  );

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setUrlInput(value);
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            url: value || undefined,
          },
        }),
      });
    },
    [navigate]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setTextInput(value);
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            text: value || undefined,
          },
        }),
      });
    },
    [navigate]
  );

  const handleTypeToggle = useCallback(
    (recordType: RecordType) => {
      void navigate({
        search: (prev) => {
          const currentTypes = prev.filters.types ?? [];
          const newTypes = currentTypes.includes(recordType)
            ? currentTypes.filter((t) => t !== recordType)
            : [...currentTypes, recordType];
          return {
            ...prev,
            filters: {
              ...prev.filters,
              types: newTypes.length > 0 ? newTypes : undefined,
            },
          };
        },
      });
    },
    [navigate]
  );

  const handleSourceToggle = useCallback(
    (source: IntegrationType) => {
      void navigate({
        search: (prev) => {
          const currentSources = prev.filters.sources ?? [];
          const newSources = currentSources.includes(source)
            ? currentSources.filter((s) => s !== source)
            : [...currentSources, source];
          return {
            ...prev,
            filters: {
              ...prev.filters,
              sources: newSources.length > 0 ? newSources : undefined,
            },
          };
        },
      });
    },
    [navigate]
  );

  const handleCuratedChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            isCurated: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handleIndexNodeChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            isIndexNode: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handleFormatChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            isFormat: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handlePrivateChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            isPrivate: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handleHasParentChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            hasParent: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handleHasMediaChange = useCallback(
    (value: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filters: {
            ...prev.filters,
            hasMedia: value === 'All' ? undefined : value === 'Yes',
          },
        }),
      });
    },
    [navigate]
  );

  const handleLimitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value === '' || /^\d+$/.test(value)) {
        setLimitInput(value);
        if (value) {
          void navigate({
            search: (prev) => ({
              ...prev,
              limit: parseInt(value, 10),
            }),
          });
        }
      }
    },
    [navigate]
  );

  // Memoize the filter sidebar content
  const FilterSidebar = useMemo(
    () => (
      <div className="-mx-4 flex min-w-48 flex-col gap-3 overflow-y-auto px-4 text-sm">
        <h3 className="mb-1 text-base">Record Filters</h3>
        <hr />
        <div className="flex flex-col gap-1.5">
          <Link to="/records" search={defaultQueueOptions}>
            Reset to Defaults
          </Link>
          <Link
            to="/records"
            search={(prev) => ({
              ...prev,
              filters: {
                isCurated: false,
                hasParent: false,
              },
            })}
          >
            Curation Queue
          </Link>
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
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            type="text"
            placeholder="Filter by title"
            value={titleInput}
            onChange={handleTitleChange}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="text">Text</Label>
          <Input
            id="text"
            type="text"
            placeholder="Filter by text content"
            value={textInput}
            onChange={handleTextChange}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="text"
            placeholder="Filter by URL"
            value={urlInput}
            onChange={handleUrlChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="curated">Is Curated?</Label>
          <ToggleGroup
            id="curated"
            type="single"
            value={filterValues.curatedValue}
            onValueChange={handleCuratedChange}
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
            value={filterValues.hasParentValue}
            onValueChange={handleHasParentChange}
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
            value={filterValues.hasMediaValue}
            onValueChange={handleHasMediaChange}
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
            value={filterValues.privateValue}
            onValueChange={handlePrivateChange}
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
    ),
    [
      types,
      handleTypeToggle,
      sources,
      handleSourceToggle,
      titleInput,
      handleTitleChange,
      urlInput,
      handleUrlChange,
      textInput,
      handleTextChange,
      limitInput,
      handleLimitChange,
      filterValues,
      handleCuratedChange,
      handleIndexNodeChange,
      handleFormatChange,
      handlePrivateChange,
      handleHasParentChange,
    ]
  );

  return queue ? (
    <div className="flex h-full grow gap-4 overflow-hidden">
      {FilterSidebar}
      <div className="flex grow overflow-hidden rounded border border-c-divider bg-c-page text-xs">
        <Table className={cn({ 'h-full': queue.ids.length === 0 })}>
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
            {queue.ids.length > 0 ? (
              queue.ids.map(({ id }) => <RecordRow key={id} id={id} />)
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
    <Placeholder>
      <Spinner />
    </Placeholder>
  );
};
