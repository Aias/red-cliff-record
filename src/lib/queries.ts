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

export type ExtractSearchResult = Prisma.ExtractGetPayload<{ include: typeof extractInclude }>;
