import { ClipboardCopyIcon, ShoppingBasketIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/app/trpc';
import { useBasket } from '@/lib/hooks/use-basket';
import { cn } from '@/lib/utils';
import { SearchResultItem } from '@/routes/records/-components/search-result-item';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Separator } from './separator';

export function Basket() {
  const basket = useBasket();
  const utils = trpc.useUtils();

  const copyIds = () => {
    const text = basket.ids.join(', ');
    void navigator.clipboard.writeText(text).then(() => toast.success('Copied IDs to clipboard'));
  };

  const copyJson = async () => {
    const records = await Promise.all(
      basket.ids.map((id) => utils.records.get.ensureData({ id }))
    );
    const text = JSON.stringify(records, null, 2);
    await navigator.clipboard.writeText(text);
    toast.success('Copied JSON to clipboard');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn('relative h-9 w-9 p-0', basket.count > 0 && 'text-c-accent')}
        >
          <ShoppingBasketIcon className="h-5 w-5" />
          {basket.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-c-main px-1 text-[10px] font-semibold leading-none text-c-main-contrast">
              {basket.count}
            </span>
          )}
          <span className="sr-only">Basket ({basket.count})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {basket.count === 0 ? (
          <p className="p-4 text-center text-sm text-c-secondary">Basket is empty</p>
        ) : (
          <>
            <ul className="max-h-80 overflow-y-auto">
              {basket.ids.map((id, i) => (
                <li key={id}>
                  {i > 0 && <Separator />}
                  <div className="group flex items-center gap-1 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <SearchResultItem id={id} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => basket.remove(id)}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex items-center gap-1 p-2">
              <Button variant="ghost" size="sm" onClick={copyIds} className="text-xs">
                <ClipboardCopyIcon />
                Copy IDs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyJson()}
                className="text-xs"
              >
                <ClipboardCopyIcon />
                Copy JSON
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={basket.clear} className="text-xs">
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
