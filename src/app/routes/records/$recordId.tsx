import { useContext, useMemo } from 'react';
import { createFileRoute, retainSearchParams } from '@tanstack/react-router';
import { RecordForm } from './-components/form';
import { RelationsList, SimilarRecords } from './-components/relations';
import { NextRecordIdContext } from './route';
import { Spinner } from '@/components';
import { useRecordTree } from '@/lib/hooks/use-records';

export const Route = createFileRoute('/records/$recordId')({
        component: RouteComponent,
        loader: async ({ context: { trpc, queryClient }, params: { recordId } }) => {
               await queryClient.ensureQueryData(trpc.records.tree.queryOptions({ id: Number(recordId) }));
        },
        search: {
                middlewares: [retainSearchParams(true)],
        },
});

function RouteComponent() {
        const { recordId: recordIdParam } = Route.useParams();
        const recordId = useMemo(() => Number(recordIdParam), [recordIdParam]);
        const nextRecordId = useContext(NextRecordIdContext);
       const { data: tree, isLoading } = useRecordTree(recordId);

       const recordIds = useMemo(() => {
               if (!tree) return [] as number[];
               const ids: number[] = [];
               const parent = tree.outgoingLinks?.[0]?.target;
               if (parent) {
                       ids.push(parent.id);
               }
               ids.push(tree.id);
               tree.incomingLinks?.forEach((l) => {
                       ids.push(l.source.id);
               });
               if (parent) {
                       const siblings = parent.incomingLinks
                               ?.map((l) => l.source)
                               .filter((s) => s.id !== tree.id)
                               .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
                       siblings?.forEach((s) => ids.push(s.id));
               }
               return ids;
       }, [tree]);

        return (
                <div className="flex flex-1 gap-4 overflow-x-auto p-4">
                       <div className="card max-w-160 min-w-100 shrink basis-1/2 overflow-y-auto">
                               {isLoading && <Spinner />}
                               {!isLoading && (
                                       <div className="flex flex-col gap-8">
                                               {recordIds.map((id) => (
                                                       <RecordForm key={id} recordId={id} nextRecordId={nextRecordId} />
                                               ))}
                                       </div>
                               )}
                       </div>
                       <div className="flex max-w-160 min-w-100 flex-1 flex-col gap-4 overflow-y-auto">
                               <RelationsList id={recordId} />
                               <SimilarRecords id={recordId} />
                       </div>
                </div>
        );
}
