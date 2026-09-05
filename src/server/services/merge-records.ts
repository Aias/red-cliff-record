import {
  airtableCreators,
  airtableExtracts,
  airtableFormats,
  airtableSpaces,
  eloMatchups,
  EloMatchupSelectSchema,
  feedEntries,
  feeds,
  githubRepositories,
  githubUsers,
  lightroomImages,
  links,
  LinkSelectSchema,
  media,
  predicateSlugs,
  raindropBookmarks,
  raindropCollections,
  raindropHighlights,
  raindropTags,
  readwiseAuthors,
  readwiseDocuments,
  readwiseTags,
  records,
  RecordSelectSchema,
  twitterTweets,
  twitterUsers,
  type LinkSelect,
  type PredicateSlug,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { and, eq, getColumns, getTableName, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import type { db } from '@/server/db/connections/postgres';
import { mergeRecords } from '@/shared/lib/merge-records';

export const integrationTableMap = {
  airtable_creators: airtableCreators,
  airtable_extracts: airtableExtracts,
  airtable_formats: airtableFormats,
  airtable_spaces: airtableSpaces,
  feed_entries: feedEntries,
  github_repositories: githubRepositories,
  github_users: githubUsers,
  lightroom_images: lightroomImages,
  raindrop_bookmarks: raindropBookmarks,
  raindrop_collections: raindropCollections,
  raindrop_highlights: raindropHighlights,
  raindrop_tags: raindropTags,
  readwise_authors: readwiseAuthors,
  readwise_documents: readwiseDocuments,
  readwise_tags: readwiseTags,
  twitter_tweets: twitterTweets,
  twitter_users: twitterUsers,
};

const integrationTables = Object.values(integrationTableMap);
const integrationTable = (name: string) =>
  integrationTables.find((table) => getTableName(table) === name);

const SnapshotRecordSchema = RecordSelectSchema.omit({ textSearch: true });

export const MergeSnapshotSchema = z.object({
  sourceRecord: SnapshotRecordSchema,
  targetRecord: SnapshotRecordSchema,
  links: z.array(
    LinkSelectSchema.extend({
      predicate: z.custom<PredicateSlug>(
        (value) => typeof value === 'string' && predicateSlugs.includes(value)
      ),
    })
  ),
  mediaAssignments: z.array(z.object({ id: z.number(), recordId: z.number().nullable() })),
  integrationAssignments: z.array(
    z.object({
      table: z.string(),
      id: z.union([z.string(), z.number()]),
      recordId: z.number(),
    })
  ),
  feedIds: z.array(z.number()),
  eloMatchups: z.array(EloMatchupSelectSchema),
});

export type MergeSnapshot = z.infer<typeof MergeSnapshotSchema>;

type MergeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function mergeRecordLinks(
  existing: readonly LinkSelect[],
  sourceId: number,
  targetId: number
) {
  const groups = new Map<
    string,
    Pick<LinkSelect, 'sourceId' | 'targetId' | 'predicate' | 'recordCreatedAt'> & {
      notes: Set<string>;
    }
  >();

  for (const link of existing) {
    const mergedSourceId = link.sourceId === sourceId ? targetId : link.sourceId;
    const mergedTargetId = link.targetId === sourceId ? targetId : link.targetId;
    if (mergedSourceId === mergedTargetId) continue;
    const key = `${mergedSourceId}-${mergedTargetId}-${link.predicate}`;
    const group = groups.get(key) ?? {
      sourceId: mergedSourceId,
      targetId: mergedTargetId,
      predicate: link.predicate,
      recordCreatedAt: link.recordCreatedAt,
      notes: new Set<string>(),
    };
    if (link.notes) group.notes.add(link.notes);
    if (link.recordCreatedAt < group.recordCreatedAt) group.recordCreatedAt = link.recordCreatedAt;
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    notes: [...group.notes].join('\n\n') || null,
    recordUpdatedAt: new Date(),
  }));
}

export async function mergeRecordsInTransaction(
  tx: MergeTransaction,
  sourceId: number,
  targetId: number
) {
  if (sourceId === targetId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Merge records: Source and target records must be different.',
    });
  }

  const ids = [sourceId, targetId];
  const { textSearch: _textSearch, ...recordColumns } = getColumns(records);
  const lockedRecords = await tx
    .select(recordColumns)
    .from(records)
    .where(inArray(records.id, ids))
    .orderBy(records.id)
    .for('update');
  const source = lockedRecords.find((record) => record.id === sourceId);
  const target = lockedRecords.find((record) => record.id === targetId);
  if (!source || !target) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Merge records: One or both records not found',
    });
  }

  const premergeMedia = await tx
    .select({ id: media.id, recordId: media.recordId })
    .from(media)
    .where(inArray(media.recordId, ids))
    .orderBy(media.id)
    .for('update');
  const premergeIntegrations: MergeSnapshot['integrationAssignments'] = [];
  for (const table of integrationTables) {
    const rows = await tx
      .select({ id: table.id, recordId: table.recordId })
      .from(table)
      .where(eq(table.recordId, sourceId))
      .orderBy(table.id)
      .for('update');
    for (const row of rows) {
      if (row.recordId !== null) {
        premergeIntegrations.push({
          table: getTableName(table),
          id: row.id,
          recordId: row.recordId,
        });
      }
    }
  }
  const premergeFeeds = await tx
    .select({ id: feeds.id })
    .from(feeds)
    .where(eq(feeds.ownerId, sourceId))
    .orderBy(feeds.id)
    .for('update');
  const premergeLinks = await tx
    .select()
    .from(links)
    .where(or(inArray(links.sourceId, ids), inArray(links.targetId, ids)))
    .orderBy(links.id)
    .for('update');
  const premergeMatchups = await tx
    .select()
    .from(eloMatchups)
    .where(
      or(
        eq(eloMatchups.recordAId, sourceId),
        eq(eloMatchups.recordBId, sourceId),
        eq(eloMatchups.winnerId, sourceId)
      )
    )
    .orderBy(eloMatchups.id)
    .for('update');

  if (source.slug) await tx.update(records).set({ slug: null }).where(eq(records.id, sourceId));
  const [updatedRecord] = await tx
    .update(records)
    .set(mergeRecords(source, target))
    .where(eq(records.id, targetId))
    .returning();
  if (!updatedRecord) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Merge records: Failed to update target record',
    });
  }
  await tx
    .update(media)
    .set({ recordId: targetId, recordUpdatedAt: new Date() })
    .where(eq(media.recordId, sourceId));
  for (const table of integrationTables) {
    await tx
      .update(table)
      .set({ recordId: targetId, recordUpdatedAt: new Date() })
      .where(eq(table.recordId, sourceId));
  }
  await tx
    .update(feeds)
    .set({ ownerId: targetId, recordUpdatedAt: new Date() })
    .where(eq(feeds.ownerId, sourceId));

  if (premergeLinks.length) {
    await tx.delete(links).where(
      inArray(
        links.id,
        premergeLinks.map((link) => link.id)
      )
    );
  }
  const mergedLinks = mergeRecordLinks(premergeLinks, sourceId, targetId);
  if (mergedLinks.length) await tx.insert(links).values(mergedLinks);

  await tx
    .delete(eloMatchups)
    .where(
      or(
        and(eq(eloMatchups.recordAId, sourceId), eq(eloMatchups.recordBId, targetId)),
        and(eq(eloMatchups.recordAId, targetId), eq(eloMatchups.recordBId, sourceId))
      )
    );
  await tx
    .update(eloMatchups)
    .set({ recordAId: targetId })
    .where(eq(eloMatchups.recordAId, sourceId));
  await tx
    .update(eloMatchups)
    .set({ recordBId: targetId })
    .where(eq(eloMatchups.recordBId, sourceId));
  await tx
    .update(eloMatchups)
    .set({ winnerId: targetId })
    .where(eq(eloMatchups.winnerId, sourceId));

  const [deletedRecord] = await tx
    .delete(records)
    .where(eq(records.id, sourceId))
    .returning({ id: records.id });
  if (!deletedRecord) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Merge records: Source record ID ${sourceId} not found for deletion.`,
    });
  }

  const snapshot: MergeSnapshot = {
    sourceRecord: source,
    targetRecord: target,
    links: premergeLinks,
    mediaAssignments: premergeMedia,
    integrationAssignments: premergeIntegrations,
    feedIds: premergeFeeds.map((feed) => feed.id),
    eloMatchups: premergeMatchups,
  };
  return {
    updatedRecord,
    deletedRecordId: sourceId,
    touchedIds: [
      ...new Set([targetId, ...mergedLinks.flatMap((link) => [link.sourceId, link.targetId])]),
    ],
    snapshot,
  };
}

export async function undoMergeInTransaction(tx: MergeTransaction, snapshot: MergeSnapshot) {
  const { sourceRecord, targetRecord } = snapshot;
  const [existingSource, existingTarget] = await Promise.all([
    tx.query.records.findFirst({ where: { id: sourceRecord.id }, columns: { id: true } }),
    tx.query.records.findFirst({ where: { id: targetRecord.id }, columns: { id: true } }),
  ]);
  if (existingSource) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Source record already exists, so the merge may have been undone.',
    });
  }
  if (!existingTarget) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Target record not found, so the merge cannot be undone.',
    });
  }

  const { id: _targetId, ...targetFields } = targetRecord;
  await tx
    .update(records)
    .set({ ...targetFields, textEmbedding: null, textEmbeddedAt: null })
    .where(eq(records.id, targetRecord.id));
  const { textEmbedding: _embedding, ...sourceFields } = sourceRecord;
  const [restoredSource] = await tx
    .insert(records)
    .values({ ...sourceFields, textEmbedding: null, textEmbeddedAt: null })
    .returning({ id: records.id });
  if (!restoredSource) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to restore source record.',
    });
  }

  for (const assignment of snapshot.mediaAssignments) {
    await tx
      .update(media)
      .set({ recordId: assignment.recordId, recordUpdatedAt: new Date() })
      .where(eq(media.id, assignment.id));
  }
  for (const assignment of snapshot.integrationAssignments) {
    const table = integrationTable(assignment.table);
    if (!table) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown integration table ${assignment.table}.`,
      });
    }
    await tx
      .update(table)
      .set({ recordId: assignment.recordId, recordUpdatedAt: new Date() })
      .where(eq(table.id, assignment.id));
  }
  if (snapshot.feedIds.length) {
    await tx
      .update(feeds)
      .set({ ownerId: sourceRecord.id, recordUpdatedAt: new Date() })
      .where(inArray(feeds.id, snapshot.feedIds));
  }
  if (snapshot.eloMatchups.length) {
    await tx.delete(eloMatchups).where(
      inArray(
        eloMatchups.id,
        snapshot.eloMatchups.map((matchup) => matchup.id)
      )
    );
    await tx.insert(eloMatchups).values(snapshot.eloMatchups);
  }

  const bothIds = [sourceRecord.id, targetRecord.id];
  await tx
    .delete(links)
    .where(or(inArray(links.sourceId, bothIds), inArray(links.targetId, bothIds)));
  if (snapshot.links.length) {
    await tx.insert(links).values(snapshot.links.map(({ id: _id, ...link }) => link));
  }

  const [restoredSourceRecord, restoredTargetRecord] = await Promise.all([
    tx.query.records.findFirst({ where: { id: sourceRecord.id } }),
    tx.query.records.findFirst({ where: { id: targetRecord.id } }),
  ]);
  if (!restoredSourceRecord || !restoredTargetRecord) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch restored records.',
    });
  }
  return {
    sourceRecord: restoredSourceRecord,
    targetRecord: restoredTargetRecord,
    touchedIds: [
      ...new Set([...bothIds, ...snapshot.links.flatMap((link) => [link.sourceId, link.targetId])]),
    ],
  };
}
