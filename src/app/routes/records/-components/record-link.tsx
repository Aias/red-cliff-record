import type { LinkOptions } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { RectangleEllipsisIcon, ShoppingBasketIcon } from 'lucide-react';
import { memo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/hover-card';
import { Spinner } from '@/components/spinner';
import { getRecordPreview, getRecordThumbnailMedia, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
import { RecordDisplay } from './record-display';
import { getRecordTitle, RecordThumbnail, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

interface RecordAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

interface RecordLinkProps {
  id: DbId;
  className?: string;
  linkOptions?: LinkOptions;
  actions?: RecordAction[] | null;
}

export const RecordLink = memo(({ id, className, linkOptions, actions }: RecordLinkProps) => {
  const { data: record, isLoading, isError } = useRecord(id);
  const inBasket = useInBasket(id);

  if (isLoading) return <Spinner />;
  if (isError || !record) {
    return (
      <div className="flex items-center gap-2 text-c-hint italic opacity-75">
        <RectangleEllipsisIcon className="size-4" />
        <span>Record not found (ID: {id})</span>
      </div>
    );
  }

  const preview = getRecordPreview(record);
  const mediaItem = getRecordThumbnailMedia(record);
  const TypeIcon = recordTypeIcons[record.type].icon;
  const videoLabel = mediaItem?.altText?.trim() || record.mediaCaption?.trim() || undefined;

  const labelElement = (
    <>
      <span>{getRecordTitle(record)}</span>
      {record.abbreviation && <span className="ml-1 text-c-hint">({record.abbreviation})</span>}
    </>
  );

  return (
    <div
      className={cn('group relative flex grow gap-3 overflow-hidden break-all', className)}
      data-selectable={actions && actions.length > 0}
    >
      <div className="flex shrink basis-full flex-col gap-[0.25em] overflow-hidden">
        <div className="flex items-center gap-1.25 overflow-hidden">
          <div className="relative size-[1lh] shrink-0">
            {actions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <RectangleEllipsisIcon
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-c-accent focus-visible:opacity-100 data-[state=open]:opacity-100"
                    role="button"
                    aria-label="Record actions menu"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {actions.map((a) => (
                    <DropdownMenuItem key={a.label} onClick={a.onClick} disabled={a.disabled}>
                      {a.icon && <a.icon />}
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <TypeIcon
              className={cn(
                'absolute inset-0 size-full text-c-hint',
                'group-data-[selectable=true]:group-hover:opacity-0',
                'peer-data-[state=open]:opacity-0'
              )}
            />
          </div>

          <div className="flex grow items-center gap-1 overflow-hidden">
            {linkOptions ? (
              <HoverCard openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <Link
                    className="mr-auto min-w-0 truncate focus-visible:underline"
                    {...linkOptions}
                  >
                    {labelElement}
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent
                  className="w-96 overflow-hidden p-0"
                  align="center"
                  side="left"
                  sideOffset={12}
                >
                  <RecordDisplay recordId={id} compact className="p-3" />
                </HoverCardContent>
              </HoverCard>
            ) : (
              <strong className="mr-auto min-w-0 flex-1 truncate">{labelElement}</strong>
            )}
            {record.sense && (
              <span className="shrink truncate text-c-hint italic">{record.sense}</span>
            )}
          </div>

          {inBasket && <ShoppingBasketIcon className="size-[0.875em] shrink-0 text-c-accent" />}
          <SourceLogos sources={record.sources} className="text-[0.875em] opacity-50" />
        </div>

        <p className="line-clamp-1 text-[0.925em] break-all text-c-secondary">{preview}</p>
      </div>

      {mediaItem && (
        <RecordThumbnail media={mediaItem} size="md" videoLabel={videoLabel} autoPlay />
      )}
    </div>
  );
});
