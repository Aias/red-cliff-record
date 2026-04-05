import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { Masonry } from '@/components/masonry';
import { Placeholder } from '@/components/placeholder';
import { Spinner } from '@/components/spinner';
import { styled } from '@/styled-system/jsx';
import { RecordDisplay } from './records/-components/record-display';

export const Route = createFileRoute('/search')({
  component: SearchPage,
  validateSearch: z.object({ q: z.string().catch('') }),
});

function SearchPage() {
  const { q } = Route.useSearch();

  const { data } = trpc.records.list.useQuery(
    { searchQuery: q || undefined, limit: 100 },
    { enabled: q.length > 0, placeholderData: (prev) => prev }
  );

  return (
    <styled.main
      css={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        overflowY: 'auto',
        padding: '4',
        flexBasis: 'full',
        color: 'display',
      }}
    >
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
            <div className="overflow-hidden rounded border border-c-divider bg-c-paper p-3 transition-colors hover:border-c-border">
              <RecordDisplay recordId={item.id} compact />
            </div>
          )}
        />
      )}
    </styled.main>
  );
}
