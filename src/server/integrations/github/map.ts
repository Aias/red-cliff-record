import {
  githubRepositories,
  githubUsers,
  records,
  type GithubRepositorySelect,
  type GithubUserSelect,
  type RecordInsert,
} from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { mapUrl } from '@/server/lib/url-utils';
import { linkRecords } from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('github', 'map');

/**
 * Maps a GitHub user to a record
 *
 * @param user - The GitHub user to map
 * @returns A record insert object
 */
const mapGithubUserToRecord = (user: GithubUserSelect): RecordInsert => {
  return {
    id: user.recordId ?? undefined,
    type: 'entity',
    title: user.name ?? user.login,
    sense: user.type === 'User' ? 'Individual' : user.type,
    abbreviation: user.name ? user.login : undefined,
    url: user.blog ? mapUrl(user.blog) : user.htmlUrl,
    avatarUrl: user.avatarUrl,
    summary: user.bio,
    isCurated: false,
    isPrivate: false,
    sources: ['github'],
    recordCreatedAt: user.recordCreatedAt,
    recordUpdatedAt: user.recordUpdatedAt,
    contentCreatedAt: user.contentCreatedAt,
    contentUpdatedAt: user.contentUpdatedAt,
  };
};

/**
 * Creates records from GitHub users that don't have associated records yet
 */
export async function createRecordsFromGithubUsers() {
  logger.start('Creating records from Github users');

  const unmappedUsers = await db.query.githubUsers.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
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
    logger.skip('No unmapped users found');
    return;
  }

  logger.info(`Found ${unmappedUsers.length} unmapped GitHub users`);

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

    logger.info(`Created record ${newRecord.id} for ${user.login} (${user.id})`);

    await db.update(githubUsers).set({ recordId: newRecord.id }).where(eq(githubUsers.id, user.id));

    // Link repositories to creator
    for (const repository of user.repositories) {
      if (repository.recordId) {
        logger.info(`Linking repository ${repository.id} to creator record ${newRecord.id}`);
        await linkRecords(repository.recordId, newRecord.id, 'created_by', db);
      }
    }
  }

  logger.complete(`Processed ${unmappedUsers.length} GitHub users`);
}

/**
 * Maps a GitHub repository to a record
 *
 * @param repository - The GitHub repository to map
 * @returns A record insert object
 */
const mapGithubRepositoryToRecord = (repository: GithubRepositorySelect): RecordInsert => {
  return {
    id: repository.recordId ?? undefined,
    type: 'artifact',
    title: repository.name,
    summary: repository.description,
    url: repository.htmlUrl,
    isCurated: false,
    isPrivate: repository.private,
    sources: ['github'],
    recordCreatedAt: repository.recordCreatedAt,
    recordUpdatedAt: repository.recordUpdatedAt,
    contentCreatedAt: repository.contentCreatedAt,
    contentUpdatedAt: repository.contentUpdatedAt,
  };
};

/**
 * Creates records from GitHub repositories that don't have associated records yet
 */
export async function createRecordsFromGithubRepositories() {
  logger.start('Creating records from Github repositories');

  const unmappedRepositories = await db.query.githubRepositories.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
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
    logger.skip('No unmapped repositories found');
    return;
  }

  logger.info(`Found ${unmappedRepositories.length} unmapped GitHub repositories`);

  for (const repository of unmappedRepositories) {
    const newRecordDefaults = mapGithubRepositoryToRecord(repository);

    const [newRecord] = await db
      .insert(records)
      .values(newRecordDefaults)
      .returning({ id: records.id });

    if (!newRecord) {
      throw new Error('Failed to create record');
    }

    logger.info(`Created record ${newRecord.id} for ${repository.name} (${repository.id})`);

    await db
      .update(githubRepositories)
      .set({ recordId: newRecord.id })
      .where(eq(githubRepositories.id, repository.id));

    // Link repository to owner
    if (repository.owner.recordId) {
      logger.info(
        `Linking repository ${repository.id} to creator record ${repository.owner.recordId}`
      );
      await linkRecords(newRecord.id, repository.owner.recordId, 'created_by', db);
    }
  }

  logger.complete(`Processed ${unmappedRepositories.length} GitHub repositories`);
}
