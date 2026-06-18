import { useEffect, useRef, useState, type ReactNode } from 'react';
import { styled } from '@/styled-system/jsx';

interface MasonryProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  columnWidth: number;
  gap: number;
  className?: string;
}

function computePositions(
  keys: string[],
  heights: Map<string, number>,
  columnCount: number,
  containerWidth: number,
  gap: number
) {
  const colWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
  const colHeights = new Array<number>(columnCount).fill(0);
  const positions = new Map<string, { x: number; y: number; width: number }>();

  for (const key of keys) {
    let shortest = 0;
    for (let i = 1; i < columnCount; i++) {
      if ((colHeights[i] ?? 0) < (colHeights[shortest] ?? 0)) shortest = i;
    }
    const x = shortest * (colWidth + gap);
    const y = colHeights[shortest] ?? 0;
    positions.set(key, { x, y, width: colWidth });
    colHeights[shortest] = y + (heights.get(key) ?? 0) + gap;
  }

  const maxHeight = Math.max(0, ...colHeights) - (keys.length > 0 ? gap : 0);
  return { positions, height: maxHeight };
}

export function Masonry<T>({
  items,
  keyExtractor,
  renderItem,
  columnWidth,
  gap,
  className,
}: MasonryProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
  const observerRef = useRef<ResizeObserver | null>(null);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Single observer for all children
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next: Map<string, number> | null = null;
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.masonryKey;
          if (!key) continue;
          const h = entry.borderBoxSize[0]?.blockSize ?? 0;
          if (prev.get(key) !== h) {
            next ??= new Map(prev);
            next.set(key, h);
          }
        }
        return next ?? prev;
      });
    });
    observerRef.current = ro;
    return () => ro.disconnect();
  }, []);

  // Observe child elements whenever items change
  useEffect(() => {
    const container = containerRef.current;
    const ro = observerRef.current;
    if (!container || !ro) return;
    for (const el of container.querySelectorAll<HTMLElement>('[data-masonry-key]')) {
      ro.observe(el);
    }
  }, [items]);

  const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (columnWidth + gap)));
  const keys = items.map(keyExtractor);
  const { positions, height } = computePositions(keys, heights, columnCount, containerWidth, gap);

  return (
    <styled.div
      ref={containerRef}
      data-slot="masonry"
      css={{ position: 'relative', marginBlockEnd: '4', flexShrink: 0 }}
      className={className}
      style={{
        height: containerWidth > 0 ? height : undefined,
        visibility: containerWidth > 0 ? undefined : 'hidden',
      }}
    >
      {items.map((item, i) => {
        const key = keys[i] ?? '';
        const pos = positions.get(key);
        return (
          <styled.div
            key={key}
            data-masonry-key={key}
            style={{
              position: 'absolute',
              top: pos?.y ?? 0,
              left: pos?.x ?? 0,
              width: pos?.width ?? columnWidth,
            }}
          >
            {renderItem(item)}
          </styled.div>
        );
      })}
    </styled.div>
  );
}
