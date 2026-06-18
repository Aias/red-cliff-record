import {
  canonicalPredicates,
  getInverse,
  PREDICATES,
  type Predicate,
  type PredicateSlug,
} from '@hozo';
import { ArrowLeftIcon, ArrowRightIcon, PlusCircleIcon } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { trpc } from '@/app/trpc';
import { Badge } from '@/components/badge';
import { Button, type ButtonProps } from '@/components/button';
import { Command } from '@/components/command';
import { Popover } from '@/components/popover';
import { Spinner } from '@/components/spinner';
import { useUpsertLink } from '@/lib/hooks/link-mutations';
import { useUpsertRecord } from '@/lib/hooks/record-mutations';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { DbId } from '@/shared/types/api';
import type { LinkPartial, RecordGet } from '@/shared/types/domain';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { ComponentProps } from '@/styled-system/types';
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

  const trigram = trpc.records.list.useQuery(
    { searchQuery: debouncedQuery, strategy: 'trigram', limit: 8 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );
  const vector = trpc.records.list.useQuery(
    { searchQuery: debouncedQuery, strategy: 'vector', limit: 8 },
    { enabled: shouldSearch, trpc: { context: { skipBatch: true } } }
  );

  const trigramResults = trigram.data?.ids ?? [];
  const trigramIds = new Set(trigramResults.map((r) => r.id));
  const vectorResults = (vector.data?.ids ?? []).filter((r) => !trigramIds.has(r.id));
  const hasResults = trigramResults.length > 0 || vectorResults.length > 0;
  const isSearching = trigram.isFetching && !trigram.data;

  return (
    <Command.Root shouldFilter={false} loop css={{ width: 'full' }} defaultValue="">
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Find a record…"
      />
      <Command.List>
        <Command.Item value="-" css={{ display: 'none' }} />

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
              <Command.Item key={id} value={String(id)} onSelect={() => onSelect(id)}>
                <SearchResultItem id={id} />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {vectorResults.length > 0 && (
          <Command.Group heading="Similar">
            {vectorResults.map(({ id }) => (
              <Command.Item key={id} value={String(id)} onSelect={() => onSelect(id)}>
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

        {!isSearching && !hasResults && shouldSearch && (
          <Command.Item disabled>No results</Command.Item>
        )}

        {shouldSearch && <Command.Separator alwaysRender />}

        <Command.Item
          disabled={query.length === 0 || trigram.isFetching}
          key="create-record"
          onSelect={() => {
            createRecordMutation.mutate(
              { type: 'artifact', title: query },
              { onSuccess: (newRecord) => onSelect(newRecord.id) }
            );
          }}
          css={{ paddingInline: '3', paddingBlock: '2' }}
        >
          <PlusCircleIcon /> Create New Record
        </Command.Item>
      </Command.List>
    </Command.Root>
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
    <Command.Root css={{ width: 'full' }} defaultValue="">
      <Command.Input autoFocus placeholder="Select relation type…" />
      <Command.List>
        <Command.Item value="-" css={{ display: 'none' }} />
        <Command.Group heading="Predicates">
          {predicates
            .filter((p) => includeNonCanonical || p.canonical)
            .map((p) => (
              <Command.Item
                css={{ display: 'flex', gap: '2', textTransform: 'capitalize' }}
                key={p.slug}
                onSelect={() => onPredicateSelect(p.slug as PredicateSlug)}
              >
                <styled.span css={{ fontWeight: 'medium' }}>{p.name}</styled.span>
                <styled.span css={{ color: 'muted' }}>{p.type}</styled.span>
              </Command.Item>
            ))}
        </Command.Group>

        {actions.length > 0 && (
          <>
            <Command.Separator />
            <Command.Group heading="Actions">
              {actions.map((a) => (
                <Command.Item key={a.key} onSelect={a.onSelect}>
                  {a.label}
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}
      </Command.List>
    </Command.Root>
  );
}

interface RelationshipSelectorRootProps {
  children: ReactNode;
  sourceId: number;
  initialTargetId?: number;
  link?: LinkPartial | null;
  onComplete?: (sourceId: number, targetId: number, predicate: PredicateSlug) => void;
  buildActions?: (ctx: {
    sourceId: number;
    targetId: number;
    link: LinkPartial | null;
  }) => RelationshipAction[];
  incoming?: boolean;
}

type RelationshipSelectorTriggerProps = ButtonProps & {
  children?: ReactNode;
};

type RelationshipSelectorContextValue = {
  actions: RelationshipAction[];
  altPressed: boolean;
  currentPredicateName?: string;
  displayPredicates: Predicate[];
  incoming: boolean;
  handlePredicateSelect: (selectedPredicate: PredicateSlug) => void;
  handleRecordSelect: (id: DbId) => void;
  targetId: number | null;
  targetRecord?: RecordGet;
};

const RelationshipSelectorContext = createContext<RelationshipSelectorContextValue | null>(null);

const defaultRelationshipSelectorTriggerCss = css.raw({
  fontWeight: 'medium',
  textTransform: 'capitalize',
  boxShadow: 'none',
});

function useRelationshipSelectorContext() {
  const context = useContext(RelationshipSelectorContext);
  if (!context) {
    throw new Error(
      'RelationshipSelector compound components must be used within RelationshipSelector.Root.'
    );
  }
  return context;
}

function RelationshipSelectorRoot({
  children,
  sourceId,
  initialTargetId,
  link = null,
  incoming = false,
  onComplete,
  buildActions,
}: RelationshipSelectorRootProps) {
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
    { enabled: targetId !== null }
  );

  // Reset unsaved state when the popover closes, unless the target is
  // controlled externally (initialTargetId) or we're editing an existing link.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) return;
    if (!initialTargetId && !link) {
      setTargetId(null);
      setPredicate(null);
    }
    altRef.current = false;
    setAltPressed(false);
  };

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
    if (!buildActions || targetId === null) return [];
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
          handleOpenChange(false);
        },
      }
    );
  };

  const currentPredicateName = useMemo(
    () => (predicate ? PREDICATES[predicate]?.name : undefined),
    [predicate]
  );
  const contextValue: RelationshipSelectorContextValue = {
    actions,
    altPressed,
    currentPredicateName,
    displayPredicates,
    incoming,
    handlePredicateSelect,
    handleRecordSelect,
    targetId,
    targetRecord,
  };

  return (
    <RelationshipSelectorContext.Provider value={contextValue}>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        {children}
      </Popover.Root>
    </RelationshipSelectorContext.Provider>
  );
}

function RelationshipSelectorTrigger({
  children,
  css: cssProp,
  size = 'sm',
  variant = 'outline',
  ...props
}: RelationshipSelectorTriggerProps) {
  const { currentPredicateName } = useRelationshipSelectorContext();

  return (
    <Popover.Trigger
      render={
        <Button
          size={size}
          variant={variant}
          {...props}
          css={css.raw(defaultRelationshipSelectorTriggerCss, cssProp)}
        >
          {children ?? currentPredicateName ?? 'Add relationship'}
        </Button>
      }
    />
  );
}

function RelationshipSelectorContent({
  className,
  side = 'left',
  align = 'start',
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof Popover.Content>) {
  const {
    actions,
    altPressed,
    displayPredicates,
    incoming,
    handlePredicateSelect,
    handleRecordSelect,
    targetId,
    targetRecord,
  } = useRelationshipSelectorContext();

  return (
    <Popover.Content
      data-has-target={targetId ? '' : undefined}
      className={className}
      css={{
        width: '[33vw]',
        maxWidth: '144',
        minWidth: '128',
        padding: '0',
        '&[data-has-target]': { width: '60', minWidth: '60' },
      }}
      side={side}
      align={align}
      collisionPadding={collisionPadding}
      {...props}
    >
      {!targetId && <RecordSearch onSelect={handleRecordSelect} />}
      {targetId && (
        <>
          <Badge
            css={{
              margin: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
              overflow: 'hidden',
              borderWidth: '1px',
              borderColor: 'divider',
              whiteSpace: 'nowrap',
            }}
          >
            {altPressed ? <ArrowLeftIcon /> : <ArrowRightIcon />}
            <styled.span css={{ flex: '1', truncate: true, textAlign: 'center' }}>
              {targetRecord ? targetRecord.title || targetRecord.id : <Spinner />}
            </styled.span>
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
    </Popover.Content>
  );
}

export const RelationshipSelector = {
  Root: RelationshipSelectorRoot,
  Trigger: RelationshipSelectorTrigger,
  Content: RelationshipSelectorContent,
};
