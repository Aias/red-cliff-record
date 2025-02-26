import {
	ArtifactIcon,
	ConceptIcon,
	EntityIcon,
	EventIcon,
	PlaceIcon,
	SystemIcon,
} from '@/components/icons';
import { type RecordType } from '@/db/schema';

// Map record types to their corresponding icons and descriptions
export const typeIcons: Record<RecordType, { icon: React.ElementType; description: string }> = {
	entity: { icon: EntityIcon, description: 'An actor in the world, has will' },
	concept: { icon: ConceptIcon, description: 'A category, idea, or abstraction' },
	artifact: { icon: ArtifactIcon, description: 'Physical or digital objects, content, or media' },
	event: { icon: EventIcon, description: 'An event or occurrence' },
	place: { icon: PlaceIcon, description: 'A geographic location' },
	system: { icon: SystemIcon, description: 'A physical or conceptual system or network' },
};
