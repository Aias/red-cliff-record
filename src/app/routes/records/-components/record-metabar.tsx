import { Link } from '@tanstack/react-router';
import { GlobeIcon, ShoppingBasketIcon, Trash2Icon } from 'lucide-react';
import { type ComponentProps, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import { AlertDialog } from '@/components/alert-dialog';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { Input } from '@/components/input';
import { IntegrationLogo } from '@/components/integration-logo';
import { Label } from '@/components/label';
import { MetadataList } from '@/components/metadata-list';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/popover';
import { Separator } from '@/components/separator';
import { Spinner } from '@/components/spinner';
import { Toggle } from '@/components/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/tooltip';
import { useDeleteRecords, useUpsertRecord } from '@/lib/hooks/record-mutations';
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
    <div className={cn('flex items-center gap-2.5', className)} {...props}>
      <Popover>
        <PopoverTrigger asChild>
          <Avatar
            src={record.avatarUrl}
            fallback={(record.title?.charAt(0) ?? record.type.charAt(0)).toUpperCase()}
            className="cursor-pointer"
          />
        </PopoverTrigger>
        <PopoverContent className="flex min-w-84 flex-col gap-3">
          <AvatarSection record={record} />
          <Separator />
          <MetadataSection record={record} />
        </PopoverContent>
      </Popover>
      <Link
        to="/records/$recordId"
        params={{ recordId }}
        className="truncate text-sm text-c-hint capitalize"
      >
        {`${record.type} #${record.id}, ${record.recordCreatedAt.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })} ${record.recordCreatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
      </Link>
      {record.sources && (
        <div className="mr-auto flex items-center gap-1">
          {record.sources.map((source) => (
            <IntegrationLogo key={source} integration={source} className="text-xs opacity-50" />
          ))}
        </div>
      )}
      <div className="flex items-center gap-0.5">
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
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <Button size="icon" variant="ghost" type="button" aria-label="Delete record">
              <Trash2Icon />
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
                <AlertDialog.Description>
                  This action cannot be undone. This will permanently delete this record.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel asChild>
                  <Button variant="outline">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button data-palette="error" variant="default" onClick={handleDelete}>
                    Continue
                  </Button>
                </AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>
  );
};

const AvatarSection = ({ record }: { record: RecordGet }) => {
  const recordId = record.id;
  const [localUrl, setLocalUrl] = useState(record.avatarUrl ?? '');
  const [prevUrl, setPrevUrl] = useState(record.avatarUrl);

  if (record.avatarUrl !== prevUrl) {
    setPrevUrl(record.avatarUrl);
    setLocalUrl(record.avatarUrl ?? '');
  }

  const upsertMutation = useUpsertRecord();
  const { mutate: fetchFavicon, isPending: isFetchingFavicon } =
    trpc.records.fetchFavicon.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalUrl(e.target.value);
  };

  const handleBlur = () => {
    const normalized = localUrl.trim() || null;
    if (normalized === record.avatarUrl) return;
    upsertMutation.mutate({ id: record.id, avatarUrl: normalized });
  };

  const handleFetchFavicon = () => {
    if (!record.url) return;
    fetchFavicon(
      { url: record.url },
      {
        onSuccess: ({ avatarUrl }) => {
          setLocalUrl(avatarUrl);
          upsertMutation.mutate({ id: record.id, avatarUrl: avatarUrl });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`avatar-url-${recordId}`}>Avatar URL</Label>
      <div className="flex items-center gap-2">
        <Input
          id={`avatar-url-${recordId}`}
          value={localUrl}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="https://example.com/image.png"
        />
        {localUrl && <ExternalLink href={localUrl} children={null} />}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!record.url || isFetchingFavicon}
            onClick={handleFetchFavicon}
          >
            {isFetchingFavicon ? <Spinner /> : <GlobeIcon />}
            Fetch favicon
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {record.url
            ? 'Fetch the favicon from the record URL'
            : 'Add a URL to the record to fetch its favicon'}
        </TooltipContent>
      </Tooltip>
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
