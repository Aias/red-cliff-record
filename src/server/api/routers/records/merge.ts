// src/server/routers/records.merge.ts
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { type DbId } from '../common';
import {
	airtableCreators,
	airtableExtracts,
	airtableFormats,
	airtableSpaces,
	githubRepositories,
	githubUsers,
	lightroomImages,
	links,
	media,
	raindropBookmarks,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseTags,
	records,
	twitterTweets,
	twitterUsers,
} from '@/db/schema';
import type { LinkInsert, RecordSelect } from '@/db/schema';

const Id = z.number().int().positive();

export const merge = publicProcedure
	.input(z.object({ sourceId: Id, targetId: Id }))
	.mutation(async ({ ctx: { db }, input }) => {
		const { sourceId, targetId } = input;
		if (sourceId === targetId) {
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Source and target must differ' });
		}

		/* ---------- read two records ---------- */
		const [source, target] = await Promise.all([
			db.query.records.findFirst({ where: { id: sourceId } }),
			db.query.records.findFirst({ where: { id: targetId } }),
		]);
		if (!source || !target) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'One or both records not found' });
		}

		/* ---------- helper ---------- */
		const mergeText = (a: string | null, b: string | null) =>
			a && b ? `${b}\n\n---\n\n${a}` : (a ?? b);
		const now = new Date();

		/* ---------- transaction ---------- */
		const result = await db.transaction(async (tx) => {
			/* 1 ▸ update target record */
			const merged: Omit<RecordSelect, 'id'> = {
				...source,
				...target, // target wins for simple scalars
				summary: mergeText(source.summary, target.summary),
				content: mergeText(source.content, target.content),
				notes: mergeText(source.notes, target.notes),
				sources:
					Array.from(new Set([...(source.sources ?? []), ...(target.sources ?? [])])) || null,
				rating: Math.max(source.rating, target.rating),
				isPrivate: source.isPrivate || target.isPrivate,
				isCurated: source.isCurated || target.isCurated,
				recordUpdatedAt: now,
				textEmbedding: null,
			};

			// clear slug on source first to avoid unique conflict
			if (source.slug) {
				await tx.update(records).set({ slug: null }).where(eq(records.id, sourceId));
			}

			const [updatedRecord] = await tx
				.update(records)
				.set(merged)
				.where(eq(records.id, targetId))
				.returning();
			if (!updatedRecord)
				throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

			/* 2 ▸ move media rows */
			await tx
				.update(media)
				.set({ recordId: targetId, recordUpdatedAt: now })
				.where(eq(media.recordId, sourceId));

			/* 3 ▸ update every integration table */
			const integrations = [
				airtableCreators,
				airtableExtracts,
				airtableFormats,
				airtableSpaces,
				githubRepositories,
				githubUsers,
				lightroomImages,
				raindropBookmarks,
				raindropCollections,
				raindropTags,
				readwiseAuthors,
				readwiseDocuments,
				readwiseTags,
				twitterTweets,
				twitterUsers,
			] as const;

			await Promise.all(
				integrations.map((tbl) =>
					tx
						.update(tbl)
						.set({ recordId: targetId, recordUpdatedAt: now })
						.where(eq(tbl.recordId, sourceId))
				)
			);

			/* 4 ▸ merge links (delete-insert-dedupe) -------------------------- */
			const linksToMerge = await tx.query.links.findMany({
				where: {
					OR: [
						{ sourceId: { in: [sourceId, targetId] } },
						{ targetId: { in: [sourceId, targetId] } },
					],
				},
			});

			const originalIds = linksToMerge.map((l) => l.id);
			if (originalIds.length) {
				await tx.delete(links).where(inArray(links.id, originalIds));
			}

			const dedupMap = new Map<string, LinkInsert>();
			for (const l of linksToMerge) {
				const newRow: LinkInsert = {
					sourceId: l.sourceId === sourceId ? targetId : l.sourceId,
					targetId: l.targetId === sourceId ? targetId : l.targetId,
					predicateId: l.predicateId,
					notes: l.notes,
					recordUpdatedAt: now,
				};
				// skip self-reference created by swap
				if (newRow.sourceId === newRow.targetId) continue;
				const key = `${newRow.sourceId}-${newRow.targetId}-${newRow.predicateId}`;
				dedupMap.set(key, newRow); // overwrites duplicates automatically
			}

			if (dedupMap.size) {
				await tx.insert(links).values([...dedupMap.values()]);
			}

			/* 5 ▸ delete source record */
			await tx.delete(records).where(eq(records.id, sourceId));

			/* 6 ▸ touched IDs for cache invalidation */
			const touchedIds: DbId[] = Array.from(
				new Set<DbId>([
					targetId,
					...[...dedupMap.values()].flatMap((l) => [l.sourceId, l.targetId]),
				])
			);

			return { updatedRecord, deletedRecordId: sourceId, touchedIds };
		});

		return result;
	});
