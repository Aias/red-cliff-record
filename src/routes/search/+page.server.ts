import { error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { extractInclude } from '$lib/queries';

const prisma = new PrismaClient();
const MAX_RECORDS = 200;

export async function load({ url }) {
	const queryParam = url.searchParams.get('q');
	if (!queryParam) {
		return {
			search: []
		};
	}
	const query = queryParam.toLowerCase();

	try {
		const searchResults = await prisma.extract.findMany({
			include: extractInclude,
			take: MAX_RECORDS,
			where: {
				title: {
					search: query
				},
				content: {
					search: query
				},
				notes: {
					search: query
				},
				sourceUrl: {
					search: query
				}
			},
			orderBy: {
				_relevance: {
					fields: ['title', 'content', 'notes', 'sourceUrl'],
					search: query,
					sort: 'desc'
				}
			}
		});

		return {
			search: searchResults
		};
	} catch (err) {
		console.error('Search query failed:', err);
		error(500, {
			message: 'An error occurred while searching.'
		});
	}
}
