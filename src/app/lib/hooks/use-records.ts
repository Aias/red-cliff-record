import { useQueries } from '@tanstack/react-query';
import { trpc } from '@/app/trpc';
import type { DbId } from '@/server/api/routers/common';
import type { ListRecordsInput } from '@/server/api/routers/records.types';

export function useRecord(id: DbId) {
	return trpc.records.get.useQuery({ id });
}

export const useRecordSuspense = (id: DbId) => {
	return trpc.records.get.useSuspenseQuery({ id });
};

export function useRecordList(args: ListRecordsInput) {
	const { data, ...rest } = trpc.records.list.useQuery(args);

	const ids = data?.ids.map((id) => id.id) ?? [];

	const utils = trpc.useUtils();

	const recordQueries = useQueries({
		queries: ids.map((id) => utils.records.get.queryOptions({ id })),
	});

	const records = recordQueries.map((q) => q.data).filter((r) => r !== undefined);

	return { ...rest, records };
}
