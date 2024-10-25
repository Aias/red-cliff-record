import { error } from '@sveltejs/kit';
import { getCreatorsList, getExtractsList, getSpacesList } from '$lib/queries';
export async function load({ params }) {
	const { entityType } = params;

	let creatorsPromise;
	let spacesPromise;
	let extractsPromise;

	switch (entityType) {
		case 'creators':
			creatorsPromise = getCreatorsList();
			break;

		case 'spaces':
			spacesPromise = getSpacesList();
			break;

		case 'extracts':
			extractsPromise = getExtractsList();
			break;

		default:
			error(500, 'Invalid entity type');
	}

	const [creators, spaces, extracts] = await Promise.all([
		creatorsPromise,
		spacesPromise,
		extractsPromise
	]);

	return {
		recentCreators: creators,
		recentSpaces: spaces,
		recentExtracts: extracts
	};
}
