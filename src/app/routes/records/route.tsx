import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import { useCallback } from 'react';
import { trpc } from '@/app/trpc';
import { RadioCards, RadioCardsItem } from '@/components/radio-cards';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import { RecordLink } from './-components/record-link';
import { RecordsGrid } from './-components/records-grid';

export const Route = createFileRoute('/records')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { state: filtersState } = useRecordFilters();
  const { data: recordsList } = trpc.records.list.useQuery(
    { ...filtersState, offset: 0 },
    { placeholderData: (prev) => prev }
  );
  const matches = useMatches();

  // Check if a record is selected by seeing if we're on a record detail route
  const isRecordSelected = matches.some((match) => match.routeId === '/records/$recordId');

  // Find the current record ID from route params
  const getSelectedRecordId = useCallback(() => {
    const recordIdMatch = matches.find((match) => match.routeId === '/records/$recordId');
    return recordIdMatch?.params?.recordId ? Number(recordIdMatch.params.recordId) : null;
  }, [matches]);

  // Calculate the currently selected record ID
  const currentRecordId = getSelectedRecordId();

  const handleValueChange = useCallback(
    (value: string) => {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: Number(value) },
      });
    },
    [navigate]
  );

  // Open first record from list view
  const openFirstRecord = useCallback(() => {
    const firstRecordId = recordsList?.ids[0]?.id;
    if (firstRecordId) {
      void navigate({
        to: '/records/$recordId',
        params: { recordId: firstRecordId },
      });
    }
  }, [recordsList, navigate]);

  // Focus current record in sidebar (or first if not found)
  const focusSidebarRecord = useCallback(() => {
    const selector = currentRecordId
      ? `[data-record-sidebar-id="${currentRecordId}"]`
      : '[data-record-sidebar-id]';
    const element = document.querySelector<HTMLElement>(selector);
    element?.focus();
  }, [currentRecordId]);

  useKeyboardShortcut('mod+arrowright', openFirstRecord, {
    description: 'Open first record',
    category: 'Records',
    when: () => !isRecordSelected,
  });

  useKeyboardShortcut('mod+arrowleft', focusSidebarRecord, {
    description: 'Focus record in sidebar',
    category: 'Records',
    when: () => isRecordSelected,
  });

  return (
    <styled.main
      data-record-selected={isRecordSelected || undefined}
      css={{
        display: 'flex',
        flexBasis: 'full',
        overflow: 'hidden',
        backgroundColor: 'background',
        containerType: 'inline-size',
        padding: '3',
        '&[data-record-selected]': { padding: '0' },
      }}
    >
      {isRecordSelected && recordsList ? (
        <>
          <styled.div
            css={{
              display: 'flex',
              minWidth: '60',
              flexShrink: '1',
              flexGrow: '0',
              flexBasis: '72',
              flexDirection: 'column',
              gap: '2',
              overflow: 'hidden',
              borderInlineEnd: 'divider',
              paddingBlock: '3',
              '@container (max-width: 40rem)': { display: 'none' },
            }}
          >
            <styled.header
              css={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingInline: '3',
              }}
            >
              <styled.h2 css={{ textStyle: 'lg', fontWeight: 'medium' }}>
                Records{' '}
                <styled.span css={{ textStyle: 'sm', color: 'secondary' }}>
                  ({recordsList.ids.length})
                </styled.span>
              </styled.h2>
              <Link to="/records" className={css({ textStyle: 'sm' })}>
                Index
              </Link>
            </styled.header>
            <RadioCards
              value={currentRecordId?.toString()}
              onValueChange={handleValueChange}
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1',
                overflowY: 'auto',
                scrollbarWidth: '[thin]',
                paddingInline: '3',
                textStyle: 'xs',
              })}
            >
              {recordsList.ids.map(({ id }) => (
                <RadioCardsItem key={id} value={id.toString()} data-record-sidebar-id={id}>
                  <RecordLink id={id} className={css({ width: 'full', overflow: 'hidden' })} />
                </RadioCardsItem>
              ))}
            </RadioCards>
          </styled.div>
          <Outlet />
        </>
      ) : (
        <RecordsGrid />
      )}
    </styled.main>
  );
}
