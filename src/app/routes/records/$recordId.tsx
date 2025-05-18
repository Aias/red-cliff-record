import { useCallback, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { useDeleteRecords, useMarkAsCurated, useRecordTree } from '@/app/lib/hooks/use-records';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { FamilyTree } from '@/server/api/routers/records/tree';
import { RecordForm } from './-components/form';
import { RelationsList, SimilarRecords } from './-components/relations';

export const Route = createFileRoute('/records/$recordId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
		await queryClient.ensureQueryData(trpc.records.get.queryOptions({ id: Number(recordId) }));
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
	const { recordId: recordIdParam } = Route.useParams();
	const recordId = useMemo(() => Number(recordIdParam), [recordIdParam]);
	const { data: tree } = useRecordTree(recordId);
	const markAsCurated = useMarkAsCurated();
	const deleteMutation = useDeleteRecords();

	const nodes = useMemo(() => {
		if (!tree) return [];
		return flattenTree(tree);
	}, [tree]);

	const handleFinalize = useCallback(() => {
		const idsToCurate = Array.from(new Set(nodes.map((t) => t.id)));
		markAsCurated.mutate({ ids: idsToCurate });

		const listIds = recordsList?.ids.map((r) => r.id) ?? [];
		const skip = new Set(idsToCurate);
		const nextId = getNextRecord(listIds, recordId, skip);

		if (nextId) {
			navigate({
				to: '/records/$recordId',
				params: { recordId: nextId.toString() },
				search: true,
			});
		} else {
			navigate({
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
				navigate({
					to: '/records/$recordId',
					params: { recordId: nextId.toString() },
					search: true,
				});
			} else {
				navigate({
					to: '/records',
					search: true,
				});
			}
		},
		[deleteMutation, recordsList, recordId, navigate]
	);

	return (
		<div className="flex flex-1 overflow-x-auto">
			<ul className="flex max-w-166 min-w-108 shrink basis-1/2 flex-col gap-4 overflow-y-auto border-r border-c-divider bg-c-mist p-3">
				{nodes.map((node) => (
					<li id={`record-${node.id}`} key={node.id} className="shrink-0">
						<RecordForm
							recordId={node.id}
							className="card py-3 transition-colors not-data-active:opacity-80 data-active:border-c-edge"
							data-active={node.id === recordId ? true : undefined}
							onFinalize={handleFinalize}
							onDelete={() => handleDelete(node.id)}
						/>
					</li>
				))}
			</ul>
			<div className="flex max-w-160 min-w-100 flex-1 flex-col gap-4 overflow-y-auto p-4">
				<RelationsList id={recordId} />
				<SimilarRecords id={recordId} />
			</div>
		</div>
	);
}
