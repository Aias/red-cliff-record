import { useCallback, useEffect, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import type { FamilyTree } from '@/server/api/routers/records/tree';
import { RecordForm } from './-components/form';
import { RecordDisplay } from './-components/record-display';
import { RelationsList, SimilarRecords } from './-components/relations';
import { Spinner } from '@/components/spinner';
import { useDeleteRecords, useMarkAsCurated } from '@/lib/hooks/record-mutations';
import { useRecordTree } from '@/lib/hooks/record-queries';
import { CoercedIdSchema, type DbId } from '@/shared/types';

export const Route = createFileRoute('/records/$recordId')({
	params: { parse: (params) => ({ recordId: CoercedIdSchema.parse(params.recordId) }) },
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions({ id: recordId }));
	},
	search: {
		middlewares: [retainSearchParams(true)],
	},
});

type TreeNode = {
	predicateId?: DbId;
	title?: string | null;
	id: DbId;
	recordCreatedAt: Date;
};

const sortByRecordCreatedAt = <T extends { recordCreatedAt: Date }>(records: T[]): T[] => {
	return [...records].sort((a, b) => a.recordCreatedAt.getTime() - b.recordCreatedAt.getTime());
};

const flattenTree = (tree: FamilyTree): TreeNode[] => {
	const nodes: TreeNode[] = [];
	const { id, incomingLinks, outgoingLinks, title, recordCreatedAt } = tree;

	// Sort outgoing links by recordCreatedAt
	const sortedOutgoingLinks = sortByRecordCreatedAt(
		outgoingLinks.map((link) => ({
			...link,
			recordCreatedAt: link.target.recordCreatedAt,
		}))
	);

	sortedOutgoingLinks.forEach((parent) => {
		const {
			predicateId: parentPredicateId,
			target: {
				id: parentId,
				title: parentTitle,
				recordCreatedAt: parentRecordCreatedAt,
				incomingLinks: parentIncomingLinks,
				outgoingLinks: parentOutgoingLinks,
			},
		} = parent;

		// Sort grandparent links by recordCreatedAt
		const sortedGrandparentLinks = sortByRecordCreatedAt(
			parentOutgoingLinks.map((link) => ({
				...link,
				recordCreatedAt: link.target.recordCreatedAt,
			}))
		);

		sortedGrandparentLinks.forEach((grandparent) => {
			const {
				predicateId: grandparentPredicateId,
				target: {
					id: grandparentId,
					title: grandparentTitle,
					recordCreatedAt: grandparentRecordCreatedAt,
				},
			} = grandparent;

			nodes.push({
				predicateId: grandparentPredicateId,
				id: grandparentId,
				title: grandparentTitle,
				recordCreatedAt: grandparentRecordCreatedAt,
			});
		});

		nodes.push({
			predicateId: parentPredicateId,
			id: parentId,
			title: parentTitle,
			recordCreatedAt: parentRecordCreatedAt,
		});

		// Sort child links by recordCreatedAt
		const sortedChildLinks = sortByRecordCreatedAt(
			parentIncomingLinks.map((link) => ({
				...link,
				recordCreatedAt: link.source.recordCreatedAt,
			}))
		);

		sortedChildLinks.forEach((child) => {
			const {
				predicateId: childPredicateId,
				source: { id: childId, title: childTitle, recordCreatedAt: childRecordCreatedAt },
			} = child;

			nodes.push({
				predicateId: childPredicateId,
				id: childId,
				title: childTitle,
				recordCreatedAt: childRecordCreatedAt,
			});
		});
	});

	// Only add if there are no outgoing links, otherwise we'll get duplicates from parent's child nodes.
	if (outgoingLinks.length === 0) {
		nodes.push({ id, title, recordCreatedAt: recordCreatedAt });
	}

	// Sort incoming links by recordCreatedAt
	const sortedIncomingLinks = sortByRecordCreatedAt(
		incomingLinks.map((link) => ({
			...link,
			recordCreatedAt: link.source.recordCreatedAt,
		}))
	);

	sortedIncomingLinks.forEach((child) => {
		const {
			predicateId: childPredicateId,
			source: { id: childId, title: childTitle, recordCreatedAt: childRecordCreatedAt },
		} = child;

		nodes.push({
			predicateId: childPredicateId,
			id: childId,
			title: childTitle,
			recordCreatedAt: childRecordCreatedAt,
		});
	});

	return nodes;
};

const getNextRecord = (ids: DbId[], currentId: DbId, skip: Set<DbId>): DbId | undefined => {
	if (ids.length === 0) return undefined;

	const currentIndex = ids.findIndex((id) => id === currentId);
	const start = currentIndex === -1 ? 0 : (currentIndex + 1) % ids.length;

	for (let i = 0; i < ids.length; i++) {
		const idx = (start + i) % ids.length;
		const id = ids[idx];
		if (id === undefined) continue;
		if (!skip.has(id)) return id;
	}

	return undefined;
};

function RouteComponent() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const { data: recordsList } = trpc.records.list.useQuery(search, {
		placeholderData: (prev) => prev,
	});
	const { recordId } = Route.useParams();
	const { data: tree, isError: treeError, isLoading: treeLoading } = useRecordTree(recordId);
	const markAsCurated = useMarkAsCurated();
	const deleteMutation = useDeleteRecords();

	// If tree query fails, it likely means the record doesn't exist (deleted or invalid ID)
	useEffect(() => {
		if (treeError && recordsList?.ids.length) {
			// Navigate to first available record
			const firstAvailableId = recordsList.ids[0]?.id;
			if (firstAvailableId && firstAvailableId !== recordId) {
				void navigate({
					to: '/records/$recordId',
					params: { recordId: firstAvailableId },
					search: true,
				});
			} else {
				// No records available, go to records list
				void navigate({
					to: '/records',
					search: true,
				});
			}
		}
	}, [treeError, recordsList, recordId, navigate]);

	const nodes = useMemo(() => {
		if (!tree) return [];
		return flattenTree(tree);
	}, [tree]);

	const handleFinalize = useCallback(() => {
		const idsToCurate = Array.from(new Set(nodes.map((t) => t.id)));

		// Calculate next ID before triggering mutations to avoid race conditions
		const listIds = recordsList?.ids.map((r) => r.id) ?? [];
		const skip = new Set(idsToCurate);
		const nextId = getNextRecord(listIds, recordId, skip);

		// Trigger mutation optimistically
		markAsCurated.mutate({ ids: idsToCurate });

		// Navigate immediately - tree structure is unaffected by curation
		if (nextId) {
			void navigate({
				to: '/records/$recordId',
				params: { recordId: nextId },
				search: true,
			});
		} else {
			void navigate({
				to: '/records',
				search: true,
			});
		}
	}, [markAsCurated, nodes, recordsList, recordId, navigate]);

	const handleDelete = useCallback(
		(id: DbId) => {
			deleteMutation.mutate([id]);
			const listIds = recordsList?.ids.map((r) => r.id) ?? [];
			const skip = new Set([id]);
			const nextId = getNextRecord(listIds, recordId, skip);

			if (nextId) {
				void navigate({
					to: '/records/$recordId',
					params: { recordId: nextId },
					search: true,
				});
			} else {
				void navigate({
					to: '/records',
					search: true,
				});
			}
		},
		[deleteMutation, recordsList, recordId, navigate]
	);

	// Show loading state while tree is loading
	if (treeLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Spinner />
			</div>
		);
	}

	// Show error state if tree failed and we couldn't navigate away
	if (treeError) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<div className="mb-2 text-c-destructive">Record not found</div>
					<div className="text-sm text-c-hint">This record may have been deleted or moved.</div>
				</div>
			</div>
		);
	}

	// Find the index of the active record to split nodes into before/after groups
	const activeIndex = nodes.findIndex((node) => node.id === recordId);
	const nodesBefore = activeIndex > 0 ? nodes.slice(0, activeIndex) : [];
	const nodesAfter =
		activeIndex >= 0 && activeIndex < nodes.length - 1 ? nodes.slice(activeIndex + 1) : [];

	return (
		<div className="flex flex-1 overflow-x-auto">
			<div className="flex max-w-166 min-w-108 shrink basis-1/2 flex-col gap-4 overflow-y-auto border-r border-c-divider p-3">
				{/* Records before the active one (parents, grandparents, etc.) */}
				{nodesBefore.length > 0 && (
					<ul className="flex flex-col gap-3">
						{nodesBefore.map((node) => (
							<li key={node.id}>
								<RecordDisplay recordId={node.id} />
							</li>
						))}
					</ul>
				)}

				{/* Active record form */}
				<RecordForm
					recordId={recordId}
					className="card border-c-edge py-3"
					onFinalize={handleFinalize}
					onDelete={() => handleDelete(recordId)}
				/>

				{/* Records after the active one (children, grandchildren, siblings, etc.) */}
				{nodesAfter.length > 0 && (
					<ul className="flex flex-col gap-3">
						{nodesAfter.map((node) => (
							<li key={node.id}>
								<RecordDisplay recordId={node.id} />
							</li>
						))}
					</ul>
				)}
			</div>
			<div className="flex max-w-160 min-w-100 flex-1 flex-col gap-4 overflow-y-auto bg-c-container p-4">
				<RelationsList id={recordId} />
				<SimilarRecords id={recordId} />
			</div>
		</div>
	);
}
