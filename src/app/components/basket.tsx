import { ClipboardCopyIcon, ShoppingBasketIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import { removeManyFromBasket, useBasket } from '@/lib/hooks/use-basket';
import { cn } from '@/lib/utils';
import type { DbId } from '@/shared/types/api';
import { RecordLink } from '../routes/records/-components/record-link';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Separator } from './separator';

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const { data } = error;
  if (!data || typeof data !== 'object' || !('code' in data)) return false;
  return data.code === 'NOT_FOUND';
}

function BasketItem({ id, onRemove }: { id: DbId; onRemove: (id: DbId) => void }) {
  const handleRemove = () => onRemove(id);

  return (
    <div className="group flex items-center gap-1 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <RecordLink id={id} />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleRemove}
      >
        <XIcon />
        <span className="sr-only">Remove</span>
      </Button>
    </div>
  );
}

export function Basket() {
  const basket = useBasket();
  const utils = trpc.useUtils();

  const copyIds = async () => {
    try {
      const text = basket.ids.join(', ');
      await navigator.clipboard.writeText(text);
      toast.success('Copied IDs to clipboard');
    } catch {
      toast.error('Failed to copy IDs to clipboard');
    }
  };

  const copyJson = async () => {
    const ids = basket.ids;
    const results = await Promise.allSettled(ids.map((id) => utils.records.get.ensureData({ id })));

    const records: unknown[] = [];
    const missingIds: DbId[] = [];
    const failedIds: DbId[] = [];

    results.forEach((result, index) => {
      const id = ids[index];
      if (id === undefined) return;

      if (result.status === 'fulfilled') {
        records.push(result.value);
        return;
      }

      if (isNotFoundError(result.reason)) {
        missingIds.push(id);
        return;
      }

      failedIds.push(id);
    });

    if (missingIds.length > 0) {
      removeManyFromBasket(missingIds);
    }

    if (records.length === 0) {
      toast.error('No valid records in basket to copy');
      return;
    }

    try {
      const text = JSON.stringify(records, null, 2);
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error('Failed to copy JSON to clipboard');
      return;
    }

    if (missingIds.length === 0 && failedIds.length === 0) {
      toast.success('Copied JSON to clipboard');
      return;
    }

    const messageParts: string[] = [
      `Copied ${records.length} record${records.length === 1 ? '' : 's'}`,
    ];
    if (missingIds.length > 0) {
      messageParts.push(`removed ${missingIds.length} missing`);
    }
    if (failedIds.length > 0) {
      messageParts.push(`${failedIds.length} failed to load`);
    }
    toast.success(messageParts.join(' • '));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn(basket.count > 0 && 'text-c-accent')}>
          <ShoppingBasketIcon />
          {basket.count > 0 && <span>{basket.count}</span>}
          <span className="sr-only">Basket ({basket.count})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-120 p-0">
        {basket.count === 0 ? (
          <p className="p-4 text-center text-sm text-c-secondary">No items in basket</p>
        ) : (
          <>
            <ul className="max-h-120 overflow-y-auto">
              {basket.ids.map((id, i) => (
                <li key={id}>
                  {i > 0 && <Separator />}
                  <BasketItem key={id} id={id} onRemove={basket.remove} />
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex items-center gap-1 p-2">
              <Button variant="ghost" size="sm" onClick={() => void copyIds()}>
                <ClipboardCopyIcon />
                Copy IDs
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void copyJson()}>
                <ClipboardCopyIcon />
                Copy JSON
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={basket.clear}>
                <Trash2Icon />
                Clear
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
