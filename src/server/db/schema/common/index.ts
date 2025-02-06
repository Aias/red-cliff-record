import { timestamp } from 'drizzle-orm/pg-core';

const recordCreatedAt = timestamp('created_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();

const recordUpdatedAt = timestamp('updated_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();

export const databaseTimestamps = {
	recordCreatedAt,
	recordUpdatedAt,
};

export const databaseTimestampsNonUpdatable = {
	recordCreatedAt,
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
