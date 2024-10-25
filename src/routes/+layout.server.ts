import { creatorInclude, spaceInclude } from '$lib/queries.js';
import { prisma } from '$lib/server/prisma';

export async function load({}) {
	const [creators, spaces] = await Promise.all([
		prisma.creator.findMany({
			include: creatorInclude,
			orderBy: {
				extracts: {
					_count: 'desc'
				}
			},
			take: 100
		}),
		prisma.space.findMany({
			include: spaceInclude,
			orderBy: {
				extracts: { _count: 'desc' }
			},
			take: 100
		})
	]);

	return {
		creators,
		spaces
	};
}
