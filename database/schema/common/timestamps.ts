import { timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
	updatedAt: timestamp({
		withTimezone: true
	}),
	createdAt: timestamp({
		withTimezone: true
	})
		.defaultNow()
		.notNull()
};
