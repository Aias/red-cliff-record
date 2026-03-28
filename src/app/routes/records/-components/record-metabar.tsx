import { Link } from '@tanstack/react-router';
import { ShoppingBasketIcon, Trash2Icon } from 'lucide-react';
import { type ComponentProps, useCallback } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/alert-dialog';
import { AlertDialogCancel, AlertDialogAction } from '@/components/alert-dialog';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MetadataList } from '@/components/metadata-list';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Toggle } from '@/components/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip';
import { useDeleteRecords } from '@/lib/hooks/record-mutations';
import { useRecord } from '@/lib/hooks/record-queries';
import { addToBasket, removeFromBasket, useInBasket } from '@/lib/hooks/use-basket';
import { cn } from '@/lib/utils';
import type { RecordGet } from '@/shared/types/domain';

type MetabarProps = ComponentProps<'div'> & {
  recordId: number;
  onDelete?: () => void;
};

export const Metabar = ({ recordId, className, onDelete, ...props }: MetabarProps) => {
  const { data: record } = useRecord(recordId);
  const inBasket = useInBasket(recordId);
  const deleteMutation = useDeleteRecords();

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
    } else {
      deleteMutation.mutate([recordId]);
    }
  }, [deleteMutation, recordId]);

  if (!record) {
    return null;
  }

  return (
    <div className={cn('flex items-center', className)} {...props}>
      <Popover>
        <PopoverTrigger asChild>
          <Avatar
            src={record.avatarUrl}
            fallback={(record.title?.charAt(0) ?? record.type.charAt(0)).toUpperCase()}
            className="mr-2 cursor-pointer"
          />
        </PopoverTrigger>
        <PopoverContent className="min-w-84">
          <MetadataSection record={record} />
        </PopoverContent>
      </Popover>
      <Link
        to="/records/$recordId"
        params={{ recordId }}
        className="mr-auto truncate font-mono text-sm text-c-secondary capitalize"
      >
        {`${record.type} #${record.id}, ${record.recordCreatedAt.toLocaleDateString()} ${record.recordCreatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
      </Link>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Toggle
                pressed={inBasket}
                aria-label={inBasket ? 'Remove from basket' : 'Add to basket'}
                onPressedChange={(pressed) => {
                  if (pressed) {
                    addToBasket(recordId);
                    toast.success('Added to basket');
                  } else {
                    removeFromBasket(recordId);
                    toast.success('Removed from basket');
                  }
                }}
              >
                <ShoppingBasketIcon />
              </Toggle>
            </span>
          </TooltipTrigger>
          <TooltipContent>{inBasket ? 'Remove from basket' : 'Add to basket'}</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" type="button" aria-label="Delete record">
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" asChild>
                <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const MetadataSection = ({ record }: { record: RecordGet }) => {
  return (
    <div className="flex flex-col gap-3">
      <h2>Record Metadata</h2>
      <MetadataList
        metadata={{
          ID: record.id,
          Slug: record.slug,
          Created: record.recordCreatedAt,
          Updated: record.recordUpdatedAt,
          'Content Created': record.contentCreatedAt,
          'Content Updated': record.contentUpdatedAt,
        }}
      />
    </div>
  );
};
