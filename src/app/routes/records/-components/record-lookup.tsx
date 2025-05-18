import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { LinkPartial } from '@/server/api/routers/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
	type PopoverContentProps,
} from '@/components/ui/popover';
import type { PredicateSelect } from '@/db/schema';
import { useUpsertLink } from '@/lib/hooks/use-records';
import { cn } from '@/lib/utils';
import { RecordSearch } from './record-search';
import { PredicateCombobox } from './predicate-combobox';

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
