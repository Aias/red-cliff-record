import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { Masonry } from '@/components/masonry';
import { Placeholder } from '@/components/placeholder';
import { Spinner } from '@/components/spinner';
import { RecordDisplay } from './records/-components/record-display';

export const Route = createFileRoute('/search')({
  component: SearchPage,
  validateSearch: z.object({ q: z.string().catch('') }),
});

function SearchPage() {
  const { q } = Route.useSearch();

  const { data } = trpc.records.search.useQuery(
    { query: q || undefined, limit: 100 },
    { enabled: q.length > 0, placeholderData: (prev) => prev }
  );

  return (
    <main className="flex basis-full flex-col gap-4 overflow-y-auto p-4">
      {!q && <Placeholder>Type a query and press Enter to search.</Placeholder>}

      {q && !data && (
        <Placeholder className="grow">
          <Spinner />
        </Placeholder>
      )}

      {q && data && data.ids.length === 0 && <Placeholder>No results found.</Placeholder>}

      {data && data.ids.length > 0 && (
        <Masonry
          items={data.ids}
          keyExtractor={(item) => String(item.id)}
          columnWidth={320}
          gap={8}
          renderItem={(item) => (
            <div className="overflow-hidden rounded border border-c-divider bg-c-page p-3 transition-colors hover:border-c-border">
              <RecordDisplay recordId={item.id} compact />
            </div>
          )}
        />
      )}
    </main>
  );
}
