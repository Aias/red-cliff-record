import { timestamp } from 'drizzle-orm/pg-core';

const createdAt = timestamp('created_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();

const updatedAt = timestamp('updated_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();

export const databaseTimestamps = {
	createdAt,
	updatedAt,
};

export const databaseTimestampsNonUpdatable = {
	createdAt,
};

const contentCreatedAt = timestamp('content_created_at', {
	withTimezone: true,
});

const contentUpdatedAt = timestamp('content_updated_at', {
	withTimezone: true,
});

export const contentTimestamps = {
	contentCreatedAt,
	contentUpdatedAt,
};

export const contentTimestampsNonUpdatable = {
	contentCreatedAt,
};
