import { FileTextIcon, LightbulbIcon, UserIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type RecordType } from '@/db/schema';

// Map record types to their corresponding icons and descriptions
export const recordTypeIcons: Record<RecordType, { icon: React.ElementType; description: string }> =
	{
		entity: { icon: UserIcon, description: 'An actor in the world, has will' },
		concept: { icon: LightbulbIcon, description: 'A category, idea, or abstraction' },
		artifact: { icon: FileTextIcon, description: 'Physical or digital objects, content, or media' },
	};

interface RecordTypeIconProps extends React.HTMLAttributes<SVGElement> {
	type: RecordType;
}

export const RecordTypeIcon = ({ type, ...props }: RecordTypeIconProps) => {
	const { icon: Icon, description } = recordTypeIcons[type];
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Icon {...props} />
			</TooltipTrigger>
			<TooltipContent>{description}</TooltipContent>
		</Tooltip>
	);
};
