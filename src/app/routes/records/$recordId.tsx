import { useCallback, useContext, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { useDeleteRecords, useMarkAsCurated, useRecordTree } from '@/app/lib/hooks/use-records';
import type { DbId } from '@/server/api/routers/common';
import type { FamilyTree } from '@/server/api/routers/records/tree';
import { RecordForm } from './-components/form';
import { RelationsList, SimilarRecords } from './-components/relations';
import { NextRecordIdContext } from './route';

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
};

const flattenTree = (tree: FamilyTree): TreeNode[] => {
	const nodes: TreeNode[] = [];
	const { id, incomingLinks, outgoingLinks, title } = tree;
	outgoingLinks.forEach((parent) => {
		const {
			predicateId: parentPredicateId,
			target: {
				id: parentId,
				title: parentTitle,
				incomingLinks: parentIncomingLinks,
				outgoingLinks: parentOutgoingLinks,
			},
		} = parent;

		parentOutgoingLinks.forEach((grandparent) => {
			const {
				predicateId: grandparentPredicateId,
				target: { id: grandparentId, title: grandparentTitle },
			} = grandparent;

			nodes.push({
				predicateId: grandparentPredicateId,
				id: grandparentId,
				title: grandparentTitle,
			});
		});

		nodes.push({ predicateId: parentPredicateId, id: parentId, title: parentTitle });

		parentIncomingLinks.forEach((child) => {
			const {
				predicateId: childPredicateId,
				source: { id: childId, title: childTitle },
			} = child;

			nodes.push({ predicateId: childPredicateId, id: childId, title: childTitle });
		});
	});

	if (outgoingLinks.length === 0) {
		nodes.push({ id, title });
	}

	incomingLinks.forEach((child) => {
		const {
			predicateId: childPredicateId,
			source: { id: childId, title: childTitle },
		} = child;

		nodes.push({ predicateId: childPredicateId, id: childId, title: childTitle });
	});

	return nodes;
};

function RouteComponent() {
	const navigate = Route.useNavigate();
	const { recordId: recordIdParam } = Route.useParams();
	const recordId = useMemo(() => Number(recordIdParam), [recordIdParam]);
	const nextRecordId = useContext(NextRecordIdContext);
	const { data: tree } = useRecordTree(recordId);
	const markAsCurated = useMarkAsCurated();
	const deleteMutation = useDeleteRecords();

	const nodes = useMemo(() => {
		if (!tree) return [];
		return flattenTree(tree);
	}, [tree]);

	const handleFinalize = useCallback(() => {
		markAsCurated.mutate({
			ids: nodes.map((t) => t.id),
		});
		if (nextRecordId) {
			navigate({
				to: '/records/$recordId',
				params: { recordId: nextRecordId.toString() },
				search: true,
			});
		} else {
			navigate({
				to: '/records',
				search: true,
			});
		}
	}, [markAsCurated, nodes]);

	const handleDelete = useCallback(
		(id: DbId) => {
			deleteMutation.mutate([id]);
			if (nextRecordId) {
				navigate({
					to: '/records/$recordId',
					params: { recordId: nextRecordId.toString() },
					search: true,
				});
			} else {
				navigate({
					to: '/records',
					search: true,
				});
			}
		},
		[deleteMutation]
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
