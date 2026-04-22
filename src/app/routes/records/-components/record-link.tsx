import type { LinkOptions } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { RectangleEllipsisIcon, ShoppingBasketIcon } from 'lucide-react';
import { memo } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/hover-card';
import { Spinner } from '@/components/spinner';
import { getRecordPreview, getRecordThumbnailMedia, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import type { DbId } from '@/shared/types/api';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { RecordDisplay } from './record-display';
import { getRecordTitle, RecordThumbnail, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

interface RecordLinkProps {
  id: DbId;
  className?: string;
  linkOptions?: LinkOptions;
}

export const RecordLink = memo(({ id, className, linkOptions }: RecordLinkProps) => {
  const { data: record, isLoading, isError } = useRecord(id);
  const inBasket = useInBasket(id);

  if (isLoading) return <Spinner />;
  if (isError || !record) {
    return (
      <styled.div
        css={{
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          color: 'muted',
          fontStyle: 'italic',
          opacity: '75%',
          _childIcon: { boxSize: '4' },
        }}
      >
        <RectangleEllipsisIcon />
        <span>Record not found (ID: {id})</span>
      </styled.div>
    );
  }

  const preview = getRecordPreview(record);
  const mediaItem = getRecordThumbnailMedia(record);
  const TypeIcon = recordTypeIcons[record.type].icon;
  const videoLabel = mediaItem?.altText?.trim() || record.mediaCaption?.trim() || undefined;

  const labelElement = (
    <>
      <span>{getRecordTitle(record)}</span>
      {record.abbreviation && (
        <styled.span css={{ marginInlineStart: '1', color: 'muted' }}>
          ({record.abbreviation})
        </styled.span>
      )}
    </>
  );

  return (
    <styled.div
      className={className}
      css={{
        display: 'flex',
        flexGrow: '1',
        gap: '3',
        overflow: 'hidden',
        wordBreak: 'break-all',
      }}
    >
      <styled.div
        css={{
          display: 'flex',
          flexShrink: '1',
          flexBasis: 'full',
          flexDirection: 'column',
          gap: '[0.25em]',
          overflow: 'hidden',
        }}
      >
        <styled.div css={{ display: 'flex', alignItems: 'center', gap: '1', overflow: 'hidden' }}>
          <TypeIcon className={css({ boxSize: 'lh', flexShrink: '0', color: 'muted' })} />

          <styled.div
            css={{
              display: 'flex',
              flexGrow: '1',
              alignItems: 'center',
              gap: '1',
              overflow: 'hidden',
            }}
          >
            {linkOptions ? (
              <HoverCard openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <Link
                    className={css({
                      marginInlineEnd: 'auto',
                      minWidth: '0',
                      truncate: true,
                      _focusVisible: { textDecoration: 'underline' },
                    })}
                    {...linkOptions}
                  >
                    {labelElement}
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent
                  className={css({ width: '96', overflow: 'hidden', padding: '0' })}
                  align="center"
                  side="left"
                  sideOffset={12}
                >
                  <RecordDisplay recordId={id} compact className={css({ padding: '3' })} />
                </HoverCardContent>
              </HoverCard>
            ) : (
              <styled.strong
                css={{ marginInlineEnd: 'auto', minWidth: '0', flex: '1', truncate: true }}
              >
                {labelElement}
              </styled.strong>
            )}
            {record.sense && (
              <styled.span
                css={{ flexShrink: '1', truncate: true, color: 'muted', fontStyle: 'italic' }}
              >
                {record.sense}
              </styled.span>
            )}
          </styled.div>

          {inBasket && <ShoppingBasketIcon className={css({ color: 'accent' })} />}
          <SourceLogos
            sources={record.sources}
            className={css({ fontSize: '[0.875em]', opacity: '50%' })}
          />
        </styled.div>

        <styled.p
          css={{
            lineClamp: '1',
            fontSize: '[0.925em]',
            wordBreak: 'break-all',
            color: 'secondary',
          }}
        >
          {preview}
        </styled.p>
      </styled.div>

      {mediaItem && (
        <RecordThumbnail media={mediaItem} size="md" videoLabel={videoLabel} autoPlay />
      )}
    </styled.div>
  );
});
