import { Calendar, FileText, Lightbulb, MapPin, User, Waypoints } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components';
import { type RecordType } from '@/db/schema';

// Map record types to their corresponding icons and descriptions
export const recordTypeIcons: Record<RecordType, { icon: React.ElementType; description: string }> =
	{
		entity: { icon: User, description: 'An actor in the world, has will' },
		concept: { icon: Lightbulb, description: 'A category, idea, or abstraction' },
		artifact: { icon: FileText, description: 'Physical or digital objects, content, or media' },
		event: { icon: Calendar, description: 'An event or occurrence' },
		place: { icon: MapPin, description: 'A geographic location' },
		system: { icon: Waypoints, description: 'A physical or conceptual system or network' },
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
