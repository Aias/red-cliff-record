import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '@/app/lib/hooks/use-debounce';
import { trpc } from '@/app/trpc';
import { RecordLink } from './record-link';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	type PopoverContentProps,
} from '@/components/ui/popover';
import type { LinkSelect, PredicateSelect, RecordSelect } from '@/db/schema';
import { cn } from '@/lib/utils';

/* --------------------------------------------------------------------------
 * RecordSearch –– picks a target record by querying the server.
 * No client‑side filtering; we rely entirely on server results.
 * -------------------------------------------------------------------------- */
interface RecordSearchProps {
	onSelect(record: RecordSelect): void;
}

function RecordSearch({ onSelect }: RecordSearchProps) {
	const [query, setQuery] = useState('');
	const debounced = useDebounce(query, 200);

	const { data = [], isFetching } = trpc.records.search.useQuery(
		{ query: debounced },
		{
			enabled: debounced.length > 0,
		}
	);

	return (
		<Command shouldFilter={false} className="w-full">
			<CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Find a record…" />

			<CommandList>
				{isFetching && <CommandItem disabled>Loading…</CommandItem>}
				{data.map((rec) => (
					<CommandItem key={rec.id} onSelect={() => onSelect(rec)}>
						<RecordLink toRecord={rec} />
					</CommandItem>
				))}
				{!isFetching && data.length === 0 && <CommandItem disabled>No results</CommandItem>}
			</CommandList>
		</Command>
	);
}

/* --------------------------------------------------------------------------
 * PredicateCombobox –– chooses a predicate (relation type).
 * -------------------------------------------------------------------------- */
interface PredicateComboboxProps {
	initialId?: number;
	onSelect(id: number): void;
	predicates: PredicateSelect[];
}

function PredicateCombobox({ onSelect, predicates }: PredicateComboboxProps) {
	return (
		<Command className="w-full">
			<CommandInput placeholder="Select relation type..." autoFocus />
			<CommandList>
				{predicates.map((p) => (
					<CommandItem
						key={p.id}
						onSelect={() => {
							onSelect(p.id);
						}}
						className="capitalize"
					>
						{p.name} ({p.type})
					</CommandItem>
				))}
			</CommandList>
		</Command>
	);
}

/* --------------------------------------------------------------------------
 * RelationshipSelector –– exported component.
 * -------------------------------------------------------------------------- */
interface RelationshipSelectorProps {
	label?: React.ReactNode;
	sourceId: number;
	/** Existing link information, if editing. */
	link?: LinkSelect | null;
	onComplete(sourceId: number, targetId: number, predicateId: number): void;
	buttonProps?: ButtonProps;
	popoverProps?: PopoverContentProps;
}

export function RelationshipSelector({
	sourceId,
	/** Existing link information, if editing. */
	link = null,
	onComplete,
	label,
	buttonProps: { className: buttonClassName, ...buttonProps } = {},
	popoverProps: { className: popoverClassName, ...popoverProps } = {},
}: RelationshipSelectorProps) {
	const [targetId, setTargetId] = useState<number | null>(link?.targetId ?? null);
	const [predicateId, setPredicateId] = useState<number | null>(link?.predicateId ?? null);
	const [isOpen, setIsOpen] = useState(false); // Control popover state
	const { data: predicates = [] } = trpc.relations.listPredicates.useQuery();

	// Sync state with link prop changes
	useEffect(() => {
		if (link) {
			setTargetId(link.targetId);
			setPredicateId(link.predicateId);
		}
		// Resetting should be handled by the parent if link becomes null/undefined
		// or by changing the component key.
	}, [link]);

	const handleRecordSelect = (record: RecordSelect) => {
		setTargetId(record.id);
		// Keep popover open to select predicate
	};

	const handlePredicateSelect = (selectedPredicateId: number) => {
		// Target ID must be set to get here
		if (targetId !== null) {
			setPredicateId(selectedPredicateId); // Update internal state
			onComplete(sourceId, targetId, selectedPredicateId); // Call parent callback
			setIsOpen(false); // Close popover
		} else {
			console.error('Predicate selected without a target record.');
			setIsOpen(false);
		}
	};

	// Calculate current predicate name based on internal state for the button label
	const currentPredicateName = useMemo(() => {
		return predicates.find((p) => p.id === predicateId)?.name;
	}, [predicateId, predicates]);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					size="sm"
					variant="outline"
					className={cn('capitalize', buttonClassName)}
					{...buttonProps}
				>
					{/* Use label prop if provided, otherwise determine based on link/state */}
					{label ?? (link && currentPredicateName ? currentPredicateName : 'Add relationship')}
				</Button>
			</PopoverTrigger>

			<PopoverContent className={cn('w-80 p-0', popoverClassName)} {...popoverProps}>
				{/* Step 1 –– choose target record (skip if already provided) */}
				{!targetId && <RecordSearch onSelect={handleRecordSelect} />}

				{/* Step 2 –– choose predicate */}
				{targetId && (
					<PredicateCombobox
						// PredicateCombobox doesn't need initialId; its display is handled by PopoverTrigger
						onSelect={handlePredicateSelect} // Use the correct handler
						predicates={predicates}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}
