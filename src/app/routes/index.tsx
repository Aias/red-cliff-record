import { createFileRoute, Link } from '@tanstack/react-router';
import { LazyVideo } from '@/components/lazy-video';
import { Spinner } from '@/components/spinner';
import { useRecordList } from '@/lib/hooks/record-queries';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const { records, isLoading, isError } = useRecordList({
    filters: {
      hasMedia: true,
    },
    limit: 100,
    offset: 0,
    orderBy: [{ field: 'recordUpdatedAt', direction: 'desc' }],
  });

  return (
    <styled.main
      css={{
        containerType: 'inline-size',
        position: 'relative',
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1',
        overflowY: 'auto',
        scrollbarWidth: '[thin]',
        padding: '1',
      }}
    >
      {isLoading && records.length === 0 && (
        <Spinner
          css={{ boxSize: '6', position: 'absolute', inset: '1/2', translateCenter: 'xy' }}
        />
      )}
      {isError && (
        <styled.p css={{ colorPalette: 'error', layerStyle: 'chromatic', color: 'accent' }}>
          Error loading records.
        </styled.p>
      )}
      {!isLoading && !isError && records.length === 0 && (
        <styled.p css={{ color: 'muted' }}>No records with media found.</styled.p>
      )}
      <styled.div
        css={{
          display: 'grid',
          width: 'full',
          gridTemplateColumns: '[repeat(auto-fill, minmax(min(100%, 12rem), 1fr))]',
          gap: '0.25',
        }}
      >
        {records.map((record) => {
          const item = record.media?.[0];
          if (!item) return null;

          return (
            <Link
              key={item.id}
              to="/records/$recordId"
              params={{ recordId: record.id }}
              className={css({
                position: 'relative',
                display: 'block',
                aspectRatio: '3/2',
                overflow: 'hidden',
                borderRadius: 'sm',
                border: 'divider',
                backgroundColor: 'surface',
                _focusVisible: {
                  outlineColor: 'focus',
                  outlineStyle: 'solid',
                  outlineWidth: '2px',
                  outlineOffset: '0.5',
                },
              })}
            >
              <styled.div
                css={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  insetInline: '0',
                  insetBlockStart: '1/2',
                  insetBlockEnd: '0',
                  zIndex: '10',
                  backgroundImage: '[linear-gradient(to top, oklch(0 0 0 / 0.8), transparent)]',
                  opacity: '75%',
                }}
              />
              {item.type === 'video' ? (
                <LazyVideo
                  src={item.url}
                  aria-label={item.altText || record.title || `Video for record ${record.id}`}
                  className={css({
                    position: 'absolute',
                    inset: '0',
                    boxSize: 'full',
                    objectFit: 'cover',
                  })}
                  muted
                  loop
                  playsInline
                  autoPlay
                />
              ) : (
                <styled.img
                  src={item.url}
                  alt={item.altText || record.title || `Media for record ${record.id}`}
                  css={{
                    position: 'absolute',
                    inset: '0',
                    boxSize: 'full',
                    objectFit: 'cover',
                  }}
                  loading="lazy"
                  decoding="async"
                />
              )}
              {record.title && (
                <styled.div
                  css={{
                    position: 'absolute',
                    insetInline: '0',
                    insetBlockEnd: '0',
                    zIndex: '20',
                    truncate: true,
                    padding: '2',
                    textStyle: 'xs',
                    color: 'white',
                    textShadow: '[0 0 4px {colors.black}]',
                  }}
                >
                  {record.title}
                </styled.div>
              )}
            </Link>
          );
        })}
      </styled.div>
    </styled.main>
  );
}
