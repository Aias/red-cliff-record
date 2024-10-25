import type { Prisma } from '@prisma/client';
import { prisma } from './server/prisma';

export const extractInclude = {
	format: true,
	creators: true,
	spaces: true,
	attachments: true,
	parent: true,
	children: true,
	connectedTo: {
		include: { to: true }
	}
};

export const creatorInclude = {
	_count: {
		select: {
			extracts: true
		}
	},
	extracts: {
		select: {
			id: true,
			title: true
		}
	}
};

export const spaceInclude = {
	_count: {
		select: {
			extracts: true
		}
	},
	extracts: {
		select: {
			id: true,
			title: true
		}
	}
};

export type ExtractSearchResult = Prisma.ExtractGetPayload<{ include: typeof extractInclude }>;
export type CreatorSearchResult = Prisma.CreatorGetPayload<{ include: typeof creatorInclude }>;
export type SpaceSearchResult = Prisma.SpaceGetPayload<{ include: typeof spaceInclude }>;

export const getCreatorsList = () =>
	prisma.creator.findMany({
		include: {
			_count: {
				select: {
					extracts: true
				}
			},
			extracts: {
				select: {
					id: true,
					title: true
				}
			}
		},
		orderBy: {
			extracts: {
				_count: 'desc'
			}
		},
		take: 100
	});

export type CreatorListResult = Awaited<ReturnType<typeof getCreatorsList>>;

export const getSpacesList = () =>
	prisma.space.findMany({
		include: {
			_count: {
				select: { extracts: true }
			},
			extracts: {
				select: {
					id: true,
					title: true
				}
			}
		},
		orderBy: {
			extracts: { _count: 'desc' }
		},
		take: 100
	});

export type SpaceListResult = Awaited<ReturnType<typeof getSpacesList>>;

export const getExtractsList = () =>
	prisma.extract.findMany({
		include: extractInclude,
		orderBy: {
			createdAt: 'desc'
		},
		where: {
			publishedOn: {
				not: null
			},
			OR: [
				{
					parentId: null
				},
				{
					children: {
						some: {}
					}
				}
			]
		},
		take: 100
	});

export type ExtractListResult = Awaited<ReturnType<typeof getExtractsList>>;
