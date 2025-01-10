import { Badge, Button, Card, Text } from '@radix-ui/themes';
import type { IndicesSelect } from '@schema/main';

interface IndexEntryCardProps {
	index: IndicesSelect;
	action?: {
		label: string;
		onClick: () => void | object | Promise<object> | Promise<void>;
	};
}

export function IndexEntryCard({ index, action }: IndexEntryCardProps) {
	return (
		<Card size="2" className="flex items-center">
			<div className="grow flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<Text size="3" weight="bold">
						{index.name}
						{index.sense && ` (${index.sense})`}
					</Text>
					<Badge size="2" color={getMainTypeColor(index.mainType)} className="capitalize">
						{index.mainType}
						{index.subType && `: ${index.subType}`}
					</Badge>
				</div>

				{index.shortName && (
					<Text color="gray" size="2">
						Also known as: {index.shortName}
					</Text>
				)}

				{index.notes && (
					<Text size="2" color="gray">
						{index.notes}
					</Text>
				)}
			</div>
			{action && (
				<div className="flex flex-col justify-center ml-2 pl-2 border-l border-divider">
					<Button size="2" variant="soft" onClick={action.onClick}>
						{action.label}
					</Button>
				</div>
			)}
		</Card>
	);
}

function getMainTypeColor(mainType: IndicesSelect['mainType']): 'blue' | 'green' | 'orange' {
	switch (mainType) {
		case 'entity':
			return 'blue';
		case 'category':
			return 'green';
		case 'format':
			return 'orange';
	}
}
