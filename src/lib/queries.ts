import type { Prisma } from '@prisma/client';

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
	}
};

export const spaceInclude = {
	_count: {
		select: {
			extracts: true
		}
	}
};

export type ExtractSearchResult = Prisma.ExtractGetPayload<{ include: typeof extractInclude }>;
export type CreatorSearchResult = Prisma.CreatorGetPayload<{ include: typeof creatorInclude }>;
export type SpaceSearchResult = Prisma.SpaceGetPayload<{ include: typeof spaceInclude }>;
