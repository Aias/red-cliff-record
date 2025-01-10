import { Link1Icon } from '@radix-ui/react-icons';
import { Checkbox, Text } from '@radix-ui/themes';
import { Icon } from '@/app/components/Icon';
import { cn } from '@/app/lib/classNames';
import type { IndicesSelect } from '@/db/schema/main';

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
					className={cn(
						'flex flex-col p-2 border rounded-2 selectable',
						archivedAt && 'opacity-80',
						selected && 'selected'
					)}
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
						<div className="flex flex-row gap-1 items-center border-t border-gray-a3 pt-2 mt-2">
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
