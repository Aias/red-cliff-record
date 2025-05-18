import { useState } from 'react';
import { useDebounce } from './use-debounce';
import { trpc } from '@/app/trpc';
import { useUpsertRecord } from './use-records';

export function useRecordSearch() {
        const [query, setQuery] = useState('');
        const debounced = useDebounce(query, 200);

        const createRecordMutation = useUpsertRecord();

        const { data = [], isFetching } = trpc.search.byTextQuery.useQuery(
                { query: debounced, limit: 5 },
                { enabled: debounced.length > 0 }
        );

        const createRecord = async () => {
                const newRecord = await createRecordMutation.mutateAsync({
                        type: 'artifact',
                        title: query,
                });
                return newRecord;
        };

        return {
                query,
                setQuery,
                results: data,
                isFetching,
                createRecord,
                createRecordMutation,
        };
}
