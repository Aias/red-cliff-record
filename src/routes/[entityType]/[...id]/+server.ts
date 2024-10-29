import { error } from '@sveltejs/kit';
import {
	getCreatorWithExtracts,
	getSpaceWithExtracts,
	getExtractWithChildren
} from '$lib/queries.js';

// Helper to convert dates in an object
function serializeDates(obj: any) {
	return JSON.parse(
		JSON.stringify(obj, (_, value) => {
			if (value instanceof Date) {
				return {
					__isDate: true,
					value: value.toISOString()
				};
			}
			return value;
		})
	);
}

export async function GET({ params }) {
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
			return new Response(JSON.stringify(serializeDates({ creator })));

		case 'spaces':
			const space = await getSpaceWithExtracts(id);
			if (!space) {
				error(404, 'Space not found.');
			}
			return new Response(JSON.stringify(serializeDates({ space })));

		case 'extracts':
			const extract = await getExtractWithChildren(id);
			if (!extract) {
				error(404, 'Extract not found.');
			}
			return new Response(JSON.stringify(serializeDates({ extract })));
	}
}
