import { error } from '@sveltejs/kit';
import {
	getCreatorWithExtracts,
	getSpaceWithExtracts,
	getExtractWithChildren
} from '$lib/queries.js';

export async function load({ params }) {
	const { id, entityType } = params;

	if (!['creators', 'spaces', 'extracts'].includes(entityType)) {
		error(500, 'Invalid entity type.');
	}

	switch (entityType) {
		case 'creators':
			const creator = await getCreatorWithExtracts(id);
			if (!creator) {
				error(404, 'Creator not found.');
			}
			return { creator };

		case 'spaces':
			const space = await getSpaceWithExtracts(id);
			if (!space) {
				error(404, 'Space not found.');
			}
			return { space };

		case 'extracts':
			const extract = await getExtractWithChildren(id);
			if (!extract) {
				error(404, 'Extract not found.');
			}
			return { extract };
	}
}
