import { eq, isNull } from 'drizzle-orm';
import { validateAndFormatUrl } from '@/app/lib/formatting';
import { db } from '@/server/db/connections';
import {
	githubRepositories,
	githubUsers,
	recordCreators,
	records,
	type GithubRepositorySelect,
	type GithubUserSelect,
	type RecordInsert,
} from '@/server/db/schema';

const mapGithubUserToRecord = (user: GithubUserSelect): RecordInsert => {
	return {
		type: 'entity',
		title: user.name ?? user.login,
		sense: user.type === 'User' ? 'Individual' : user.type,
		abbreviation: user.name ? user.login : undefined,
		url: user.blog ? validateAndFormatUrl(user.blog) : user.htmlUrl,
		avatarUrl: user.avatarUrl,
		summary: user.bio,
		needsCuration: true,
		isIndexNode: true,
		isPrivate: false,
		sources: ['github'],
		recordCreatedAt: user.recordCreatedAt,
		recordUpdatedAt: user.recordUpdatedAt,
		contentCreatedAt: user.contentCreatedAt,
		contentUpdatedAt: user.contentUpdatedAt,
	};
};

export async function createRecordsFromGithubUsers() {
	console.log('Creating records from Github users');
	const unmappedUsers = await db.query.githubUsers.findMany({
		where: isNull(githubUsers.recordId),
		with: {
			repositories: {
				columns: {
					id: true,
					recordId: true,
				},
			},
		},
	});
	if (unmappedUsers.length === 0) {
		console.log('No unmapped users found');
		return;
	}

	for (const user of unmappedUsers) {
		const newEntityDefaults = mapGithubUserToRecord(user);
		const [newRecord] = await db
			.insert(records)
			.values(newEntityDefaults)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		console.log(`Created record ${newRecord.id} for ${user.login} (${user.id})`);
		await db.update(githubUsers).set({ recordId: newRecord.id }).where(eq(githubUsers.id, user.id));

		for (const repository of user.repositories) {
			if (repository.recordId) {
				console.log(`Linking repository ${repository.id} to creator record ${newRecord.id}`);
				await db
					.insert(recordCreators)
					.values({
						recordId: repository.recordId,
						creatorId: newRecord.id,
						creatorRole: 'creator',
					})
					.onConflictDoNothing();
			}
		}
	}
}

const mapGithubRepositoryToRecord = (repository: GithubRepositorySelect): RecordInsert => {
	return {
		type: 'artifact',
		title: repository.name,
		summary: repository.description,
		url: repository.htmlUrl,
		needsCuration: true,
		isPrivate: repository.private,
		sources: ['github'],
		recordCreatedAt: repository.recordCreatedAt,
		recordUpdatedAt: repository.recordUpdatedAt,
		contentCreatedAt: repository.contentCreatedAt,
		contentUpdatedAt: repository.contentUpdatedAt,
	};
};

export async function createRecordsFromGithubRepositories() {
	console.log('Creating records from Github repositories');
	const unmappedRepositories = await db.query.githubRepositories.findMany({
		where: isNull(githubRepositories.recordId),
		with: {
			owner: {
				columns: {
					id: true,
					recordId: true,
				},
			},
		},
	});
	if (unmappedRepositories.length === 0) {
		console.log('No unmapped repositories found');
		return;
	}

	for (const repository of unmappedRepositories) {
		const newRecordDefaults = mapGithubRepositoryToRecord(repository);
		const [newRecord] = await db
			.insert(records)
			.values(newRecordDefaults)
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		console.log(`Created record ${newRecord.id} for ${repository.name} (${repository.id})`);
		await db
			.update(githubRepositories)
			.set({ recordId: newRecord.id })
			.where(eq(githubRepositories.id, repository.id));

		if (repository.owner.recordId) {
			console.log(`Linking repository ${repository.id} to creator record ${newRecord.id}`);
			await db
				.insert(recordCreators)
				.values({
					recordId: newRecord.id,
					creatorId: repository.owner.recordId,
					creatorRole: 'creator',
				})
				.onConflictDoNothing();
		}
	}
}
