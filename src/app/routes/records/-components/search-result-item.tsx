import { ShoppingBasketIcon } from 'lucide-react';
import { memo } from 'react';
import { getRecordPreview, getRecordThumbnailMedia, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import { toTitleCase } from '@/shared/lib/formatting';
import type { DbId } from '@/shared/types/api';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { getRecordTitle, RecordThumbnail, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

const Row = styled('div', {
  base: {
    display: 'flex',
    width: 'full',
    flexGrow: '1',
    alignItems: 'center',
    gap: '2',
  },
});

export const SearchResultItem = memo(function SearchResultItem({ id }: { id: DbId }) {
  const { data: record } = useRecord(id);
  const inBasket = useInBasket(id);

  if (!record) {
    return (
      <Row>
        <styled.div
          css={{ boxSize: 'lh', flexShrink: '0', borderRadius: 'md', backgroundColor: 'mist' }}
        />
        <styled.div
          css={{ height: 'lh', flex: '1', borderRadius: 'md', backgroundColor: 'mist' }}
        />
      </Row>
    );
  }

  const preview = getRecordPreview(record);
  const mediaItem = getRecordThumbnailMedia(record);
  const TypeIcon = recordTypeIcons[record.type].icon;
  const videoLabel = mediaItem?.altText?.trim() || record.mediaCaption?.trim() || undefined;

  return (
    <Row>
      <TypeIcon className={css({ boxSize: 'lh', color: 'muted' })} />
      <styled.div
        css={{
          display: 'flex',
          flexGrow: '1',
          alignItems: 'center',
          gap: '1',
          truncate: true,
        }}
      >
        <styled.div css={{ minWidth: '0', flexShrink: '0' }}>
          <styled.strong css={{ color: 'accent' }}>
            {getRecordTitle(record, `Untitled ${toTitleCase(record.type)}`)}
          </styled.strong>
          {record.abbreviation && (
            <styled.span css={{ marginInlineStart: '1', color: 'muted' }}>
              ({record.abbreviation})
            </styled.span>
          )}
        </styled.div>
        {record.sense && (
          <styled.span
            css={{ flexShrink: '0', truncate: true, color: 'muted', fontStyle: 'italic' }}
          >
            {record.sense}
          </styled.span>
        )}
        <styled.div
          css={{
            marginInlineStart: '2',
            flexShrink: '1',
            truncate: true,
            color: 'secondary',
          }}
        >
          {preview}
        </styled.div>
      </styled.div>
      {mediaItem && <RecordThumbnail media={mediaItem} size="sm" videoLabel={videoLabel} />}
      {inBasket && (
        <ShoppingBasketIcon className={css({ flexShrink: '0', color: 'accent', opacity: '60%' })} />
      )}
      <SourceLogos
        sources={record.sources}
        className={css({ fontSize: '[0.75em]', opacity: '50%' })}
      />
    </Row>
  );
});
