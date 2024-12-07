import { timestamp } from 'drizzle-orm/pg-core';

export const databaseTimestamps = {
	createdAt: timestamp('created_at', {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
	updatedAt: timestamp('updated_at', {
		withTimezone: true,
	}),
};

export const contentTimestamps = {
	contentCreatedAt: timestamp('content_created_at', {
		withTimezone: true,
	}),
	contentUpdatedAt: timestamp('content_updated_at', {
		withTimezone: true,
	}),
};
