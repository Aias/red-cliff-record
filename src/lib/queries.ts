import type { Prisma } from '@prisma/client';
import { prisma } from './server/prisma';

export const creatorLinkSelect = {
	id: true,
	name: true
} as const;
export type CreatorLinkResult = Prisma.CreatorGetPayload<{
	select: typeof creatorLinkSelect;
}>;

export const spaceLinkSelect = {
	id: true,
	topic: true
} as const;
export type SpaceLinkResult = Prisma.SpaceGetPayload<{
	select: typeof spaceLinkSelect;
}>;

export const extractLinkSelect = {
	id: true,
	title: true,
	orderKey: true,
	creators: {
		select: creatorLinkSelect
	},
	spaces: {
		select: spaceLinkSelect
	}
} as const;

export const extractPartialInclude = {
	format: true,
	creators: {
		select: creatorLinkSelect
	},
	spaces: {
		select: spaceLinkSelect
	},
	parent: {
		select: extractLinkSelect
	},
	children: {
		orderBy: {
			orderKey: 'asc'
		},
		select: extractLinkSelect
	},
	connectedTo: {
		include: {
			to: {
				select: extractLinkSelect
			}
		}
	},
	attachments: true
} as const;

export const extractInclude = {
	...extractPartialInclude,
	parent: {
		include: extractPartialInclude
	},
	children: {
		orderBy: {
			orderKey: 'asc'
		},
		include: extractPartialInclude
	},
	connectedTo: {
		include: {
			to: {
				include: extractPartialInclude
			}
		}
	}
} as const;

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
} as const;

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
} as const;

export type ExtractLinkResult = Prisma.ExtractGetPayload<{
	include: typeof extractPartialInclude;
}>;
export type ExtractSearchResult = Prisma.ExtractGetPayload<{
	include: typeof extractInclude;
}>;
export type CreatorSearchResult = Prisma.CreatorGetPayload<{ include: typeof creatorInclude }>;
export type SpaceSearchResult = Prisma.SpaceGetPayload<{ include: typeof spaceInclude }>;

export const getCreatorCounts = () =>
	prisma.creator.findMany({
		select: {
			id: true,
			name: true,
			_count: {
				select: {
					extracts: true
				}
			}
		},
		take: 100,
		orderBy: {
			score: 'desc'
		}
	});

export type CreatorCountsResult = Awaited<ReturnType<typeof getCreatorCounts>>;

export const getSpacesCounts = () =>
	prisma.space.findMany({
		select: {
			id: true,
			topic: true,
			_count: {
				select: {
					extracts: true
				}
			}
		},
		take: 100,
		orderBy: {
			score: 'desc'
		}
	});

export type SpaceCountsResult = Awaited<ReturnType<typeof getSpacesCounts>>;

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
			score: 'desc'
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
			score: 'desc'
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

export const getExtractWithChildren = (id: string) =>
	prisma.extract.findUnique({
		where: { id },
		include: extractInclude
	});

export type ExtractWithChildrenResult = Awaited<ReturnType<typeof getExtractWithChildren>>;

export const getCreatorWithExtracts = (id: string) =>
	prisma.creator.findUnique({
		where: { id },
		include: {
			extracts: {
				include: extractInclude
			}
		}
	});

export type CreatorWithExtractsResult = Awaited<ReturnType<typeof getCreatorWithExtracts>>;

export const getSpaceWithExtracts = (id: string) =>
	prisma.space.findUnique({
		where: { id },
		include: {
			extracts: {
				include: extractInclude
			}
		}
	});

export type SpaceWithExtractsResult = Awaited<ReturnType<typeof getSpaceWithExtracts>>;
