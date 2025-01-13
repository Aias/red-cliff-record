import { Link1Icon } from '@radix-ui/react-icons';
import { Checkbox, Text } from '@radix-ui/themes';
import { Icon } from '~/app/components/Icon';
import type { IndicesSelect } from '~/server/db/schema/main';

type QueueEntry = {
	id: string;
	name: string;
	description?: string | null;
	archivedAt?: Date | null;
	indexEntry?: IndicesSelect | null;
	selected: boolean;
};

interface QueueListProps {
	entries: QueueEntry[];
	selectedIds: Set<string>;
	toggleSelection: (id: string) => void;
	onEntryClick: (id: string) => void;
}

export const QueueList = ({
	entries,
	selectedIds,
	toggleSelection,
	onEntryClick,
}: QueueListProps) => {
	return (
		<ul className="flex flex-col gap-2">
			{entries.map(({ id, name, description, indexEntry, archivedAt, selected }) => (
				<li
					key={id}
					data-status={selected ? 'active' : undefined}
					data-archived={Boolean(archivedAt)}
					className="flex selectable flex-col rounded-2 border p-2 data-archived:opacity-80"
					onClick={() => {
						onEntryClick(id);
					}}
				>
					<div className="flex flex-row items-center gap-2">
						<Checkbox
							checked={selectedIds.has(id)}
							onClick={(e) => {
								e.stopPropagation();
								console.log('Checkbox selection:', id);
								toggleSelection(id);
							}}
						/>
						<Text className="grow" color={archivedAt ? 'gray' : 'grass'} weight="medium">
							{name}
						</Text>
					</div>
					{description && (
						<Text color="gray" size="2">
							{description}
						</Text>
					)}
					{indexEntry && (
						<div className="mt-2 flex flex-row items-center gap-1 border-t border-gray-a3 pt-2">
							<Icon size="3" color={archivedAt ? 'gray' : 'grass'} className="mr-1">
								<Link1Icon />
							</Icon>
							<Text size="2" color="gray" className="capitalize">
								{indexEntry.mainType}:
							</Text>
							<Text size="2">{indexEntry.name}</Text>
						</div>
					)}
				</li>
			))}
		</ul>
	);
};
