import { ArrowUpDownIcon, ChevronDownIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/button';
import { DropdownMenu } from '@/components/dropdown-menu';
import { Label } from '@/components/label';
import { defaultOrderBy, useRecordFilters } from '@/lib/hooks/use-record-filters';
import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { SystemStyleObject } from '@/styled-system/types';

type SortMenuProps = {
  hideLabel?: boolean;
  css?: SystemStyleObject;
};

export function SortMenu({ hideLabel, css: cssProp }: SortMenuProps) {
  const triggerId = useId();
  const { state, setOrderBy } = useRecordFilters();
  const sortValue = Array.isArray(state.orderBy) ? 'date' : 'random';

  const handleSortByDate = () => {
    setOrderBy(defaultOrderBy);
  };

  const handleSortByRandom = () => {
    setOrderBy({ mode: 'random', seed: Math.floor(Math.random() * 0x100000000) });
  };

  useKeyboardShortcut('r', handleSortByRandom, {
    description: 'Randomize record order',
    category: 'Records',
  });

  return (
    <styled.div css={css.raw({ display: 'flex', flexDirection: 'column', gap: '1.5' }, cssProp)}>
      <Label
        htmlFor={triggerId}
        data-hidden={hideLabel || undefined}
        css={{ '&[data-hidden]': { srOnly: true } }}
      >
        Sort By
      </Label>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          id={triggerId}
          render={
            <Button
              variant="outline"
              css={{
                width: 'full',
                justifyContent: 'space-between',
                _childIcon: {
                  boxSize: '4',
                  opacity: '50%',
                },
              }}
            >
              <styled.span css={{ display: 'flex', alignItems: 'center', gap: '2' }}>
                <ArrowUpDownIcon />
                {sortValue === 'random' ? 'Random' : 'Date Created'}
              </styled.span>
              <ChevronDownIcon />
            </Button>
          }
        />
        <DropdownMenu.Content align="start" css={{ width: '48' }}>
          <DropdownMenu.RadioGroup value={sortValue}>
            <DropdownMenu.RadioItem value="date" onClick={handleSortByDate}>
              Date Created
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="random" onClick={handleSortByRandom}>
              Random
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </styled.div>
  );
}
