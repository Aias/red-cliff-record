import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { RadioCards, RadioCardsItem } from '@/components/radio-cards';
import { useRecordFilters } from '@/lib/hooks/use-record-filters';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { RecordLink } from './-components/record-link';
import { RecordsGrid } from './-components/records-grid';

export const Route = createFileRoute('/records')({
  component: RouteComponent,
  validateSearch: z.object({ q: z.string().optional() }),
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { q } = Route.useSearch();
  const { state: filtersState } = useRecordFilters();
  const { data: recordsList } = trpc.records.search.useQuery(
    { query: q, ...filtersState, offset: 0 },
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
    const firstRecordId = recordsList?.items[0]?.id;
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
    <main className={`flex basis-full overflow-hidden ${!isRecordSelected ? 'p-3' : ''}`}>
      {isRecordSelected && recordsList ? (
        <>
          <div className="flex min-w-60 shrink grow-0 basis-72 flex-col gap-2 overflow-hidden border-r border-c-divider bg-c-container py-3">
            <header className="flex items-center justify-between px-3">
              <h2 className="text-lg font-medium">
                Records{' '}
                <span className="text-sm text-c-secondary">({recordsList.items.length})</span>
              </h2>
              <Link to="/records" className="text-sm">
                Index
              </Link>
            </header>
            <RadioCards
              value={currentRecordId?.toString()}
              onValueChange={handleValueChange}
              className="flex flex-col gap-1 overflow-y-auto px-3 text-xs"
            >
              {recordsList.items.map(({ id }) => (
                <RadioCardsItem key={id} value={id.toString()} data-record-sidebar-id={id}>
                  <RecordLink id={id} className="w-full overflow-hidden" />
                </RadioCardsItem>
              ))}
            </RadioCards>
          </div>
          <Outlet />
        </>
      ) : (
        <RecordsGrid q={q} />
      )}
    </main>
  );
}
