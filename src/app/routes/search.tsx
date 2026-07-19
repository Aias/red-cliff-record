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
        <Placeholder css={{ flexGrow: '1' }}>
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
            <styled.div
              css={{
                overflow: 'hidden',
                borderRadius: 'md',
                borderWidth: '1px',
                borderColor: 'divider',
                _hover: {
                  borderColor: 'border',
                },
                backgroundColor: 'surface',
                padding: '3',
                transition: 'colors',
              }}
            >
              <RecordDisplay recordId={item.id} compact />
            </styled.div>
          )}
        />
      )}
    </styled.main>
  );
}
