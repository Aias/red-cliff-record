import { integer } from 'drizzle-orm/pg-core';

export const stats = {
	changes: integer(),
	additions: integer(),
	deletions: integer()
};
