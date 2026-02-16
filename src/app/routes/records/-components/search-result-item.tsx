import { memo } from 'react';
import { getRecordPreview, getRecordThumbnailMedia, useRecord } from '@/lib/hooks/record-queries';
import { toTitleCase } from '@/shared/lib/formatting';
import type { DbId } from '@/shared/types/api';
import { getRecordTitle, RecordThumbnail, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

export const SearchResultItem = memo(function SearchResultItem({ id }: { id: DbId }) {
  const { data: record } = useRecord(id);

  if (!record) {
    return (
      <div className="flex w-full grow items-center gap-2">
        <div className="size-[1lh] shrink-0 rounded bg-c-mist" />
        <div className="h-[1lh] flex-1 rounded bg-c-mist" />
      </div>
    );
  }

  const preview = getRecordPreview(record);
  const mediaItem = getRecordThumbnailMedia(record);
  const TypeIcon = recordTypeIcons[record.type].icon;
  const videoLabel = mediaItem?.altText?.trim() || record.mediaCaption?.trim() || undefined;

  return (
    <div className="flex w-full grow items-center gap-2">
      <TypeIcon className="size-[1lh] text-c-hint" />
      <div className="line-clamp-1 flex grow items-center gap-1 truncate overflow-ellipsis whitespace-nowrap">
        <div className="min-w-0 shrink-0">
          <strong className="text-c-accent">
            {getRecordTitle(record, `Untitled ${toTitleCase(record.type)}`)}
          </strong>
          {record.abbreviation && <span className="ml-1 text-c-hint">({record.abbreviation})</span>}
        </div>
        {record.sense && (
          <span className="shrink-0 truncate text-c-hint italic">{record.sense}</span>
        )}
        <div className="ml-2 line-clamp-1 shrink truncate text-c-secondary">{preview}</div>
      </div>
      {mediaItem && <RecordThumbnail media={mediaItem} size="sm" videoLabel={videoLabel} />}
      <SourceLogos sources={record.sources} className="text-[0.75em] opacity-50" />
    </div>
  );
});
