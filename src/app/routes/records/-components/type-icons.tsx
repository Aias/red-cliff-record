import type { RecordType } from '@hozo/schema/records';
import { FileTextIcon, LightbulbIcon, UserIcon } from 'lucide-react';
import { memo } from 'react';
import { Tooltip } from '@/components/tooltip';
import { exhaustive } from '@/shared/lib/type-utils';

// Map record types to their corresponding icons and descriptions
export const recordTypeIcons: Record<RecordType, { icon: React.ElementType; description: string }> =
  {
    entity: { icon: UserIcon, description: 'An actor in the world, has will' },
    concept: { icon: LightbulbIcon, description: 'A category, idea, or abstraction' },
    artifact: { icon: FileTextIcon, description: 'Physical or digital objects, content, or media' },
  };

/**
 * Record types in display order, shared by the record form's type toggle and the
 * similar-records type filter so both present the same sequence. Distinct from the
 * schema's `recordTypes` order, which is fixed by the `record_type` Postgres enum.
 */
export const recordTypeOrder = exhaustive<RecordType>()(['artifact', 'concept', 'entity']);

interface RecordTypeIconProps extends React.HTMLAttributes<SVGElement> {
  type: RecordType;
}

export const RecordTypeIcon = memo(({ type, ...props }: RecordTypeIconProps) => {
  const { icon: Icon, description } = recordTypeIcons[type];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Icon {...props} />} />
      <Tooltip.Content>{description}</Tooltip.Content>
    </Tooltip.Root>
  );
});
