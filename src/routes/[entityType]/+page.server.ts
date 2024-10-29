import { error } from '@sveltejs/kit';
import { getCreatorsList, getExtractsList, getSpacesList } from '$lib/queries';
export async function load({ params }) {
	const { entityType } = params;

	switch (entityType) {
		case 'creators':
			const creators = await getCreatorsList();
			return { recentCreators: creators };

		case 'spaces':
			const spaces = await getSpacesList();
			return { recentSpaces: spaces };

		case 'extracts':
			const extracts = await getExtractsList();
			return { recentExtracts: extracts };

		default:
			error(500, 'Invalid entity type');
	}
}
