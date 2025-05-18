import type { DbId } from '@/server/api/routers/common';
import { PlusCircleIcon } from 'lucide-react';
import { useRecordSearch } from '@/lib/hooks/use-record-search';
import { SearchResultItem } from './search-result-item';
import {
        Command,
        CommandGroup,
        CommandInput,
        CommandItem,
        CommandList,
        CommandLoading,
        CommandSeparator,
} from '@/components/ui/command';

interface RecordSearchProps {
        onSelect(id: DbId): void;
}

export function RecordSearch({ onSelect }: RecordSearchProps) {
        const { query, setQuery, results, isFetching, createRecord } = useRecordSearch();

        return (
                <Command shouldFilter={false} loop className="w-full">
                        <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Find a record…" />
                        <CommandList>
                                <CommandGroup heading="Search results">
                                        {isFetching && <CommandLoading>Loading results...</CommandLoading>}
                                        {results.map((result) => (
                                                <CommandItem
                                                        key={result.id}
                                                        value={`${result.title ?? 'Untitled'}--${result.id}`}
                                                        onSelect={() => onSelect(result.id)}
                                                >
                                                        <SearchResultItem result={result} />
                                                </CommandItem>
                                        ))}
                                        {!isFetching && results.length === 0 && <CommandItem disabled>No results</CommandItem>}
                                </CommandGroup>
                                <CommandSeparator alwaysRender />
                                <CommandItem
                                        disabled={query.length === 0 || isFetching}
                                        key="create-record"
                                        onSelect={async () => {
                                                const newRecord = await createRecord();
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
