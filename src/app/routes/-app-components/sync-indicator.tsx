import { Spinner } from '@/components/spinner';
import { Tooltip } from '@/components/tooltip';
import { useSynced } from '@/lib/sync-status';
import { styled } from '@/styled-system/jsx';

/**
 * Visible while the initial Zero preload is still streaming in. The entry
 * animation is delayed so the indicator only appears when the sync is slow
 * (a cold replica), not on the quick confirmation of a warm start.
 */
export function SyncIndicator() {
  const synced = useSynced();
  if (synced) return null;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <styled.span
            role="status"
            css={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              textStyle: 'sm',
              color: 'muted',
              animateIn: true,
              fadeIn: 0,
              animationDuration: '300',
              animationTimingFunction: 'easeOut.quad',
              animationDelay: '500',
              animationFillMode: 'backwards',
            }}
          >
            <Spinner />
            Syncing
          </styled.span>
        }
      />
      <Tooltip.Content>Downloading the latest records to this device</Tooltip.Content>
    </Tooltip.Root>
  );
}
