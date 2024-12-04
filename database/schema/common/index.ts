import { timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
	updatedAt: timestamp('updated_at', {
		withTimezone: true,
	}),
	createdAt: timestamp('created_at', {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
};
