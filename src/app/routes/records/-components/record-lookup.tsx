import {
  canonicalPredicates,
  getInverse,
  PREDICATES,
  type Predicate,
  type PredicateSlug,
} from '@hozo';
import { ArrowLeftIcon, ArrowRightIcon, PlusCircleIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { trpc } from '@/app/trpc';
import { Badge } from '@/components/badge';
import { Button, type ButtonProps } from '@/components/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverContentProps,
} from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { useUpsertLink } from '@/lib/hooks/link-mutations';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
import type { LinkPartial } from '@/shared/types/domain';
import { SearchResultItem } from './search-result-item';
import { RecordTypeIcon } from './type-icons';

/* --------------------------------------------------------------------------
 * Types for extra, runtime‑supplied actions shown after the predicate list.
 * -------------------------------------------------------------------------- */
export interface RelationshipAction {
  /** Stable key for React */
  key: string;
  /** Rendered content – can be any React node (icons, styled spans, etc.) */
  label: ReactNode;
  onSelect(): void;
}

/* --------------------------------------------------------------------------
 * RecordSearch –– picks a target record by querying the server.
 * No client‑side filtering; we rely entirely on server results.
 * -------------------------------------------------------------------------- */
interface RecordSearchProps {
  onSelect(id: DbId): void;
}

function RecordSearch({ onSelect }: RecordSearchProps) {
  const [query, setQuery] = useState('');
  const createRecordMutation = useUpsertRecord();

  const debouncedQuery = useDebounce(query, 200);
  const shouldSearch = debouncedQuery.length >= 1;

  const trigram = trpc.records.search.useQuery(
    { query: debouncedQuery, strategy: 'trigram', limit: 8 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );
  const vector = trpc.records.search.useQuery(
    { query: debouncedQuery, strategy: 'vector', limit: 8 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );

  const trigramResults = trigram.data?.items ?? [];
  const trigramIds = new Set(trigramResults.map((r) => r.id));
  const vectorResults = (vector.data?.items ?? []).filter((r) => !trigramIds.has(r.id));
  const hasResults = trigramResults.length > 0 || vectorResults.length > 0;
  const isSearching = trigram.isFetching && !trigram.data;

  return (
    <Command shouldFilter={false} loop className="w-full" defaultValue="">
      <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Find a record…" />
      <CommandList>
        <CommandItem value="-" className="hidden" />

        {shouldSearch && isSearching && (
          <CommandItem disabled className="flex items-center justify-center">
            <Spinner className="size-4" />
          </CommandItem>
        )}

        {trigramResults.length > 0 && (
          <CommandGroup heading="Text Matches">
            {trigramResults.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.title ?? 'Untitled'}--${result.id}`}
                onSelect={() => onSelect(result.id)}
              >
                <SearchResultItem result={result} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {vectorResults.length > 0 && (
          <CommandGroup heading="Similar">
            {vectorResults.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.title ?? 'Untitled'}--${result.id}`}
                onSelect={() => onSelect(result.id)}
              >
                <SearchResultItem result={result} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {vector.isFetching && !vector.data && trigramResults.length > 0 && (
          <CommandItem disabled className="flex items-center justify-center">
            <Spinner className="size-4" />
          </CommandItem>
        )}

        {!isSearching && !hasResults && shouldSearch && (
          <CommandItem disabled>No results</CommandItem>
        )}

        <CommandSeparator alwaysRender />
        <CommandItem
          disabled={query.length === 0 || trigram.isFetching}
          key="create-record"
          onSelect={() => {
            createRecordMutation.mutate(
              { type: 'artifact', title: query },
              { onSuccess: (newRecord) => onSelect(newRecord.id) }
            );
          }}
          className="px-3 py-2"
        >
          <PlusCircleIcon /> Create New Record
        </CommandItem>
      </CommandList>
    </Command>
  );
}

/* --------------------------------------------------------------------------
 * PredicateCombobox –– chooses a predicate (relation type) and shows
 * extra runtime actions (delete link, merge, open record, …).
 * -------------------------------------------------------------------------- */
interface PredicateComboboxProps {
  predicates: Predicate[];
  onPredicateSelect(slug: PredicateSlug): void;
  actions?: RelationshipAction[];
  includeNonCanonical?: boolean;
}

function PredicateCombobox({
  predicates,
  onPredicateSelect,
  actions = [],
  includeNonCanonical = false,
}: PredicateComboboxProps) {
  return (
    <Command className="w-full" defaultValue="">
      <CommandInput autoFocus placeholder="Select relation type…" />
      <CommandList>
        <CommandItem value="-" className="hidden" />
        <CommandGroup heading="Predicates">
          {predicates
            .filter((p) => includeNonCanonical || p.canonical)
            .map((p) => (
              <CommandItem
                className="flex gap-2 capitalize"
                key={p.slug}
                onSelect={() => onPredicateSelect(p.slug as PredicateSlug)}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-c-hint">{p.type}</span>
              </CommandItem>
            ))}
        </CommandGroup>

        {actions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {actions.map((a) => (
                <CommandItem key={a.key} onSelect={a.onSelect}>
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}

/* --------------------------------------------------------------------------
 * RelationshipSelector –– exported component.
 * buildActions now only receives a **defined** targetId – we invoke it
 * only after the user has selected a record.
 * -------------------------------------------------------------------------- */
interface RelationshipSelectorProps {
  label?: ReactNode;
  sourceId: number;
  /** Explicitly set target ID to skip record search. */
  initialTargetId?: number;
  /** Existing link information, if editing. */
  link?: LinkPartial | null;
  /** Called after any predicate or action completes. */
  onComplete?: (sourceId: number, targetId: number, predicate: PredicateSlug) => void;
  buttonProps?: ButtonProps;
  popoverProps?: PopoverContentProps;
  /** Optional extra‑action builder; receives runtime context. */
  buildActions?: (ctx: {
    sourceId: number;
    /** Selected record – guaranteed non‑null */
    targetId: number;
    link: LinkPartial | null;
  }) => RelationshipAction[];
  /**
   * Show predicates from the opposite direction. Used for incoming
   * relations so the dropdown displays the inverse labels.
   */
  incoming?: boolean;
}

export function RelationshipSelector({
  sourceId,
  initialTargetId,
  link = null,
  label,
  incoming = false,
  onComplete,
  buildActions,
  buttonProps: { className: buttonClassName, ...buttonProps } = {},
  popoverProps: { className: popoverClassName, ...popoverProps } = {},
}: RelationshipSelectorProps) {
  const initialTarget = initialTargetId ?? link?.targetId ?? null;
  const [targetId, setTargetId] = useState<number | null>(initialTarget);
  const [predicate, setPredicate] = useState<PredicateSlug | null>(link?.predicate ?? null);
  const [open, setOpen] = useState(false);
  const altRef = useRef(false);
  const [altPressed, setAltPressed] = useState(false);

  const displayPredicates = useMemo(() => {
    if (!incoming) return canonicalPredicates;
    // For incoming links, show inverse predicates
    const list = canonicalPredicates.map((p) => getInverse(p.slug as PredicateSlug));
    // Dedupe by slug
    const map = new Map<string, Predicate>();
    list.forEach((p) => map.set(p.slug, p));
    return Array.from(map.values());
  }, [incoming]);
  const { data: targetRecord } = trpc.records.get.useQuery(
    { id: targetId! },
    { enabled: targetId != null }
  );

  /* --------------------------------------------------
   * Reset unsaved state when the popover closes, unless
   * the target is controlled externally (initialTargetId) or editing mode.
   * -------------------------------------------------- */
  useEffect(() => {
    if (!open && !initialTargetId && !link) {
      setTargetId(null);
      setPredicate(null);
    }
    if (!open) {
      altRef.current = false;
      setAltPressed(false);
    }
  }, [open, initialTargetId, link]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        altRef.current = true;
        setAltPressed(true);
      }
    };
    const handleKeyUp = () => {
      altRef.current = false;
      setAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const actions = useMemo<RelationshipAction[]>(() => {
    if (!buildActions || targetId == null) return [];
    return buildActions({ sourceId, targetId, link });
  }, [buildActions, sourceId, targetId, link]);

  const upsertLinkMutation = useUpsertLink();

  const handleRecordSelect = (id: DbId) => setTargetId(id);

  const handlePredicateSelect = (selectedPredicate: PredicateSlug) => {
    if (!targetId) return;
    setPredicate(selectedPredicate);
    const swap = altRef.current;
    altRef.current = false;
    setAltPressed(false);
    upsertLinkMutation.mutate(
      {
        id: link?.id,
        sourceId: swap ? targetId : sourceId,
        targetId: swap ? sourceId : targetId,
        predicate: selectedPredicate,
      },
      {
        onSuccess: (updatedLink) => {
          onComplete?.(updatedLink.sourceId, updatedLink.targetId, updatedLink.predicate);
          setOpen(false);
        },
      }
    );
  };

  const currentPredicateName = useMemo(
    () => (predicate ? PREDICATES[predicate]?.name : undefined),
    [predicate]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          {...buttonProps}
          className={cn('font-medium capitalize shadow-none', buttonClassName)}
        >
          {label ?? (link && currentPredicateName ? currentPredicateName : 'Add relationship')}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-[33vw] max-w-140 min-w-120 p-0',
          targetId && 'w-60 min-w-60',
          popoverClassName
        )}
        side="left"
        align="start"
        avoidCollisions
        collisionPadding={8}
        {...popoverProps}
      >
        {!targetId && <RecordSearch onSelect={handleRecordSelect} />}

        {targetId && (
          <>
            <Badge className="m-1 flex items-center justify-center gap-2 overflow-hidden border border-c-divider whitespace-nowrap">
              {altPressed ? <ArrowLeftIcon /> : <ArrowRightIcon />}
              <span className="flex-1 truncate text-center">
                {targetRecord ? targetRecord.title || targetRecord.id : <Spinner />}
              </span>
              {targetRecord && <RecordTypeIcon type={targetRecord.type} />}
            </Badge>
            <PredicateCombobox
              predicates={displayPredicates}
              includeNonCanonical={incoming}
              onPredicateSelect={handlePredicateSelect}
              actions={actions}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
