import { useZero } from '@rocicorp/zero/react';
import { ClipboardCopyIcon, ShoppingBasketIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { removeManyFromBasket, useBasket } from '@/lib/hooks/use-basket';
import type { DbId } from '@/shared/types/api';
import { queries } from '@/shared/zero/queries';
import { styled } from '@/styled-system/jsx';
import { RecordLink } from '../routes/records/-components/record-link';
import { Button } from './button';
import { Popover } from './popover';
import { Separator } from './separator';

function BasketItem({ id, onRemove }: { id: DbId; onRemove: (id: DbId) => void }) {
  const handleRemove = () => onRemove(id);

  return (
    <styled.div
      className="group"
      css={{
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        paddingInline: '3',
        paddingBlock: '2',
        textStyle: 'xs',
      }}
    >
      <RecordLink id={id} css={{ minWidth: '0', flex: '1' }} />
      <Button
        variant="ghost"
        size="icon-sm"
        css={{
          flexShrink: '0',
          opacity: '25%',
          transition: 'opacity',
          _groupHover: {
            opacity: '100%',
          },
        }}
        onClick={handleRemove}
      >
        <XIcon />
        <styled.span css={{ srOnly: true }}>Remove</styled.span>
      </Button>
    </styled.div>
  );
}

export function Basket() {
  const basket = useBasket();
  const zero = useZero();

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
    const rows = await zero.run(queries.recordsByIds({ ids }));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const records = ids.flatMap((id) => byId.get(id) ?? []);
    const missingIds = ids.filter((id) => !byId.has(id));

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

    if (missingIds.length === 0) {
      toast.success('Copied JSON to clipboard');
      return;
    }

    const copied = `Copied ${records.length} record${records.length === 1 ? '' : 's'}`;
    toast.success(`${copied} • removed ${missingIds.length} missing`);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button variant="ghost" css={basket.count > 0 ? { color: 'accent' } : undefined}>
            <ShoppingBasketIcon />
            {basket.count > 0 && <span>{basket.count}</span>}
            <styled.span css={{ srOnly: true }}>items in basket</styled.span>
          </Button>
        }
      />
      <Popover.Content
        align="end"
        css={{ width: basket.count > 0 ? '128' : '[max-content]', padding: '0' }}
      >
        {basket.count === 0 ? (
          <styled.p
            css={{
              padding: '4',
              textAlign: 'center',
              textStyle: 'sm',
              color: 'muted',
            }}
          >
            No items in basket
          </styled.p>
        ) : (
          <>
            <styled.ul css={{ maxHeight: '128', overflowY: 'auto' }}>
              {basket.ids.map((id, i) => (
                <li key={id}>
                  {i > 0 && <Separator />}
                  <BasketItem key={id} id={id} onRemove={basket.remove} />
                </li>
              ))}
            </styled.ul>
            <Separator />
            <styled.div
              css={{
                display: 'flex',
                alignItems: 'center',
                gap: '1',
                padding: '2',
              }}
            >
              <Button variant="ghost" size="sm" onClick={() => void copyIds()}>
                <ClipboardCopyIcon />
                Copy IDs
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void copyJson()}>
                <ClipboardCopyIcon />
                Copy JSON
              </Button>
              <styled.div css={{ flex: '1' }} />
              <Button variant="ghost" size="sm" onClick={basket.clear}>
                <Trash2Icon />
                Clear
              </Button>
            </styled.div>
          </>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
