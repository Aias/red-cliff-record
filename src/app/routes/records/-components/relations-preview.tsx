import { getInverse, PREDICATES, type PredicateType } from '@hozo';
import { useRecordLinks } from '@/lib/hooks/record-queries';
import type { DbId } from '@/shared/types/api';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { SystemStyleObject } from '@/styled-system/types';
import { RecordLink } from './record-link';
import { PREDICATE_TYPE_ORDER } from './relations';

/** Cap per predicate group so heavily-linked records stay scannable */
const MAX_PER_PREDICATE = 10;

interface PredicateGroup {
  key: string;
  label: string;
  type: PredicateType | undefined;
  recordIds: DbId[];
}

/**
 * Read-only summary of a record's relationships, grouped by predicate.
 * Incoming links are labeled with the inverse predicate so every group reads
 * from the record's perspective.
 */
export function RelationsPreview({ id, css: cssProp }: { id: DbId; css?: SystemStyleObject }) {
  const { data: recordLinks } = useRecordLinks(id);

  const groups = new Map<string, PredicateGroup>();
  const add = (key: string, label: string, type: PredicateType | undefined, recordId: DbId) => {
    const group = groups.get(key) ?? { key, label, type, recordIds: [] };
    group.recordIds.push(recordId);
    groups.set(key, group);
  };
  for (const link of recordLinks?.outgoingLinks ?? []) {
    const predicate = PREDICATES[link.predicate];
    add(link.predicate, predicate?.name ?? link.predicate, predicate?.type, link.targetId);
  }
  for (const link of recordLinks?.incomingLinks ?? []) {
    const inverse = getInverse(link.predicate);
    add(`inverse:${link.predicate}`, inverse.name, inverse.type, link.sourceId);
  }

  const sorted = [...groups.values()].sort((a, b) => {
    const orderA = a.type ? PREDICATE_TYPE_ORDER.indexOf(a.type) : PREDICATE_TYPE_ORDER.length;
    const orderB = b.type ? PREDICATE_TYPE_ORDER.indexOf(b.type) : PREDICATE_TYPE_ORDER.length;
    return orderA - orderB;
  });
  if (sorted.length === 0) return null;

  return (
    <styled.dl
      css={css.raw(
        { display: 'flex', flexDirection: 'column', gap: '3', textStyle: 'xs' },
        cssProp
      )}
    >
      {sorted.map((group) => (
        <div key={group.key}>
          <styled.dt
            css={{
              marginBlockEnd: '1.5',
              fontFamily: 'mono',
              fontWeight: 'semibold',
              textTransform: 'uppercase',
              color: 'secondary',
            }}
          >
            {group.label}
          </styled.dt>
          {group.recordIds.slice(0, MAX_PER_PREDICATE).map((recordId) => (
            <styled.dd key={recordId} css={{ marginBlockEnd: '1.5' }}>
              <RecordLink
                id={recordId}
                linkOptions={{ to: '/records/$recordId', params: { recordId } }}
              />
            </styled.dd>
          ))}
          {group.recordIds.length > MAX_PER_PREDICATE && (
            <styled.dd css={{ color: 'muted' }}>
              +{group.recordIds.length - MAX_PER_PREDICATE} more
            </styled.dd>
          )}
        </div>
      ))}
    </styled.dl>
  );
}
