import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { PlusCircleIcon } from 'lucide-react';
import { useDebounce } from '@/app/lib/hooks/use-debounce';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { LinkPartial } from '@/server/api/routers/records.types';
import { RecordLink } from './record-link';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandLoading,
	CommandSeparator,
} from '@/components/ui/command';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	type PopoverContentProps,
} from '@/components/ui/popover';
import type { PredicateSelect } from '@/db/schema';
import { useUpsertLink, useUpsertRecord } from '@/lib/hooks/use-records';
import { cn } from '@/lib/utils';

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
	const navigate = useNavigate();
	const debounced = useDebounce(query, 200);

	const createRecordMutation = useUpsertRecord();

	const { data = [], isFetching } = trpc.records.searchByTextQuery.useQuery(
		{ query: debounced },
		{ enabled: debounced.length > 0 }
	);

	return (
		<Command shouldFilter={false} loop={true} className="w-full">
			<CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Find a record…" />
			<CommandList>
				<CommandGroup heading="Search results">
					{isFetching && <CommandLoading>Loading results...</CommandLoading>}
					{data.map(({ id }) => (
						<CommandItem key={id} onSelect={() => onSelect(id)}>
							<RecordLink id={id} />
						</CommandItem>
					))}
					{!isFetching && data.length === 0 && <CommandItem disabled>No results</CommandItem>}
				</CommandGroup>
				<CommandSeparator alwaysRender />
				<CommandItem
					disabled={query.length === 0}
					key="create-record"
					onSelect={async () => {
						const newRecord = await createRecordMutation.mutateAsync({
							type: 'artifact',
							title: query,
						});
						navigate({
							to: '/records/$recordId',
							params: { recordId: newRecord.id.toString() },
							search: true,
						});
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
		<Command className="w-full">
			<CommandInput autoFocus placeholder="Select relation type…" />
			<CommandList>
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
}

export function RelationshipSelector({
	sourceId,
	initialTargetId,
	link = null,
	label,
	onComplete,
	buildActions,
	buttonProps: { className: buttonClassName, ...buttonProps } = {},
	popoverProps: { className: popoverClassName, ...popoverProps } = {},
}: RelationshipSelectorProps) {
	const initialTarget = initialTargetId ?? link?.targetId ?? null;
	const [targetId, setTargetId] = useState<number | null>(initialTarget);
	const [predicateId, setPredicateId] = useState<number | null>(link?.predicateId ?? null);
	const [open, setOpen] = useState(false);

	const { data: predicates = [] } = trpc.links.listPredicates.useQuery();

	/* --------------------------------------------------
	 * Reset unsaved state when the popover closes, unless
	 * the target is controlled externally (initialTargetId) or editing mode.
	 * -------------------------------------------------- */
	useEffect(() => {
		if (!open && !initialTargetId && !link) {
			setTargetId(null);
			setPredicateId(null);
		}
	}, [open, initialTargetId, link]);

	const actions = useMemo<RelationshipAction[]>(() => {
		if (!buildActions || targetId == null) return [];
		return buildActions({ sourceId, targetId, link });
	}, [buildActions, sourceId, targetId, link]);

	const upsertLinkMutation = useUpsertLink();

	const handleRecordSelect = (id: DbId) => setTargetId(id);

	const handlePredicateSelect = async (predId: number) => {
		if (!targetId) return;
		setPredicateId(predId);
		const updatedLink = await upsertLinkMutation.mutateAsync({
			id: link?.id,
			sourceId,
			targetId,
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

			<PopoverContent className={cn('w-80 p-0', popoverClassName)} {...popoverProps}>
				{!targetId && <RecordSearch onSelect={handleRecordSelect} />}

				{targetId && (
					<PredicateCombobox
						predicates={predicates}
						onPredicateSelect={handlePredicateSelect}
						actions={actions}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}
