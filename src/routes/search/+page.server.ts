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
			where: {
				OR: [
					{ title: { contains: query } },
					{ content: { contains: query } },
					{ notes: { contains: query } },
					{ sourceUrl: { contains: query } }
				]
			},
			take: MAX_RECORDS,
			orderBy: [{ michelinStars: 'desc' }, { updatedAt: 'desc' }]
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
