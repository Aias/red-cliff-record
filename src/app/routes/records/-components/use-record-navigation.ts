import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import type { DbId } from '@/shared/types/api';

export function useRecordNavigation() {
  const navigate = useNavigate();

  return (recordId: DbId) => (event: MouseEvent<HTMLElement>) => {
    const { target, currentTarget } = event;
    if (
      event.defaultPrevented ||
      !(target instanceof Element) ||
      !currentTarget.contains(target) ||
      target.closest(
        'a, button, input, select, textarea, [role="button"], video[controls], audio[controls], [contenteditable="true"]'
      )
    ) {
      return;
    }

    event.stopPropagation();
    void navigate({ to: '/records/$recordId', params: { recordId } });
  };
}
