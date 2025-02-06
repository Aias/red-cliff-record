import { eq, isNull } from 'drizzle-orm';
import { validateAndFormatUrl } from '~/app/lib/formatting';
import { db } from '~/server/db/connections';
import {
	githubRepositories,
	githubUsers,
	indices,
	recordCreators,
	records,
	type GithubRepositorySelect,
	type GithubUserSelect,
	type IndicesInsert,
	type RecordInsert,
} from '~/server/db/schema';

const mapGithubUserToEntity = (user: GithubUserSelect): IndicesInsert => {
	return {
		mainType: 'entity',
		subType: user.type === 'User' ? 'Individual' : user.type,
		name: user.name ?? user.login,
		shortName: user.name ? user.login : undefined,
		canonicalUrl: user.blog ? validateAndFormatUrl(user.blog) : user.htmlUrl,
		canonicalMediaUrl: user.avatarUrl,
		notes: user.bio,
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: user.recordCreatedAt,
		recordUpdatedAt: user.recordUpdatedAt,
		contentCreatedAt: user.contentCreatedAt,
		contentUpdatedAt: user.contentUpdatedAt,
	};
};

export async function createEntitiesFromGithubUsers() {
	const unmappedUsers = await db.query.githubUsers.findMany({
		where: isNull(githubUsers.indexEntryId),
		with: {
			repositories: {
				columns: {
					id: true,
					recordId: true,
				},
			},
		},
	});

	for (const user of unmappedUsers) {
		const newEntityDefaults = mapGithubUserToEntity(user);
		const [newEntity] = await db
			.insert(indices)
			.values(newEntityDefaults)
			.returning({ id: indices.id });
		if (!newEntity) {
			throw new Error('Failed to create entity');
		}
		await db
			.update(githubUsers)
			.set({ indexEntryId: newEntity.id })
			.where(eq(githubUsers.id, user.id));

		for (const repository of user.repositories) {
			if (repository.recordId) {
				await db
					.insert(recordCreators)
					.values({
						role: 'creator',
						recordId: repository.recordId,
						entityId: newEntity.id,
					})
					.onConflictDoNothing();
			}
		}
	}
}

const mapGithubRepositoryToRecord = (repository: GithubRepositorySelect): RecordInsert => {
	return {
		title: repository.fullName,
		content: repository.description,
		url: repository.htmlUrl,
		needsCuration: true,
		isPrivate: repository.private,
		recordCreatedAt: repository.recordCreatedAt,
		recordUpdatedAt: repository.recordUpdatedAt,
		contentCreatedAt: repository.contentCreatedAt,
		contentUpdatedAt: repository.contentUpdatedAt,
	};
};

export async function createRecordsFromGithubRepositories() {
	const unmappedRepositories = await db.query.githubRepositories.findMany({
		where: isNull(githubRepositories.recordId),
		with: {
			owner: {
				columns: {
					id: true,
					indexEntryId: true,
				},
			},
		},
	});

	for (const repository of unmappedRepositories) {
		const newRecordDefaults = mapGithubRepositoryToRecord(repository);
		const [newRecord] = await db
			.insert(records)
			.values(newRecordDefaults)
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		await db
			.update(githubRepositories)
			.set({ recordId: newRecord.id })
			.where(eq(githubRepositories.id, repository.id));

		if (repository.owner.indexEntryId) {
			await db
				.insert(recordCreators)
				.values({
					role: 'creator',
					recordId: newRecord.id,
					entityId: repository.owner.indexEntryId,
				})
				.onConflictDoNothing();
		}
	}
}
