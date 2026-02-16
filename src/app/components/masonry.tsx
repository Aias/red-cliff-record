import { LayoutGroup, motion, MotionConfig } from 'motion/react';
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
  const heightsRef = useRef(new Map<string, number>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

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
      let changed = false;
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.masonryKey;
        if (!key) continue;
        const h = entry.borderBoxSize[0]?.blockSize ?? 0;
        if (heightsRef.current.get(key) !== h) {
          heightsRef.current.set(key, h);
          changed = true;
        }
      }
      if (changed) rerender();
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
  const { positions, height } = computePositions(
    keys,
    heightsRef.current,
    columnCount,
    containerWidth,
    gap
  );

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div
          ref={containerRef}
          data-slot="masonry"
          className={cn('relative mb-4 shrink-0', className)}
          style={{
            height: containerWidth > 0 ? height : undefined,
            visibility: containerWidth > 0 ? undefined : 'hidden',
          }}
        >
          {items.map((item, i) => {
            const key = keys[i] ?? '';
            const pos = positions.get(key);
            return (
              <motion.div
                key={key}
                layout="position"
                transition={{ layout: { duration: 0.1, ease: [0.4, 0, 0.2, 1] } }}
                data-masonry-key={key}
                style={{
                  position: 'absolute',
                  top: pos?.y ?? 0,
                  left: pos?.x ?? 0,
                  width: pos?.width ?? columnWidth,
                }}
              >
                {renderItem(item)}
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
