import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, PlusCircleIcon } from 'lucide-react';
import { useDebounce } from '@/app/lib/hooks/use-debounce';
import { trpc } from '@/app/trpc';
import { SearchResultItem } from './search-result-item';
import { RecordTypeIcon } from './type-icons';
import { Badge } from '@/components/badge';
import { Button, type ButtonProps } from '@/components/button';
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandLoading,
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
import { cn } from '@/lib/utils';
import type { PredicateSelect } from '@/shared/types';
import type { DbId } from '@/shared/types';
import type { LinkPartial } from '@/shared/types';

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
	const debounced = useDebounce(query, 200);

	const createRecordMutation = useUpsertRecord();

	const { data = [], isFetching } = trpc.search.byTextQuery.useQuery(
		{ query: debounced, limit: 5 },
		{ enabled: debounced.length > 0 }
	);

	return (
		<Command shouldFilter={false} loop className="w-full" defaultValue="">
			<CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Find a record…" />
			<CommandList>
				<CommandItem value="-" className="hidden" />
				<CommandGroup heading="Search results">
					{isFetching && <CommandLoading>Loading results...</CommandLoading>}
					{data.map((result) => (
						<CommandItem
							key={result.id}
							value={`${result.title ?? 'Untitled'}--${result.id}`}
							onSelect={() => onSelect(result.id)}
						>
							<SearchResultItem result={result} />
						</CommandItem>
					))}
					{!isFetching && data.length === 0 && <CommandItem disabled>No results</CommandItem>}
				</CommandGroup>
				<CommandSeparator alwaysRender />
				<CommandItem
					disabled={query.length === 0 || isFetching}
					key="create-record"
					onSelect={async () => {
						const newRecord = await createRecordMutation.mutateAsync({
							type: 'artifact',
							title: query,
						});
						onSelect(newRecord.id);
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
	predicates: PredicateSelect[];
	onPredicateSelect(id: number): void;
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
								key={p.id}
								onSelect={() => onPredicateSelect(p.id)}
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
	onComplete?: (sourceId: number, targetId: number, predicateId: number) => void;
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
	const [predicateId, setPredicateId] = useState<number | null>(link?.predicateId ?? null);
	const [open, setOpen] = useState(false);
	const altRef = useRef(false);
	const [altPressed, setAltPressed] = useState(false);

	const { data: predicates = [] } = trpc.links.listPredicates.useQuery();
	const predicatesBySlug = useMemo(
		() => Object.fromEntries(predicates.map((p) => [p.slug, p])),
		[predicates]
	);
	const canonicalPredicates = useMemo(() => predicates.filter((p) => p.canonical), [predicates]);
	const displayPredicates = useMemo(() => {
		if (!incoming) return canonicalPredicates;
		const list = canonicalPredicates.map((p) => {
			const slug = p.inverseSlug;
			return slug ? (predicatesBySlug[slug] ?? p) : p;
		});
		const map = new Map<number, PredicateSelect>();
		list.forEach((p) => map.set(p.id, p));
		return Array.from(map.values());
	}, [incoming, canonicalPredicates, predicatesBySlug]);
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
			setPredicateId(null);
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

	const handlePredicateSelect = async (predId: number) => {
		if (!targetId) return;
		setPredicateId(predId);
		const swap = altRef.current;
		altRef.current = false;
		setAltPressed(false);
		const updatedLink = await upsertLinkMutation.mutateAsync({
			id: link?.id,
			sourceId: swap ? targetId : sourceId,
			targetId: swap ? sourceId : targetId,
			predicateId: predId,
		});
		onComplete?.(updatedLink.sourceId, updatedLink.targetId, updatedLink.predicateId);
		setOpen(false);
	};

	const currentPredicateName = useMemo(
		() => predicates.find((p) => p.id === predicateId)?.name,
		[predicateId, predicates]
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
