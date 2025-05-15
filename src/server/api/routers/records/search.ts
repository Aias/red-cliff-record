import { TRPCError } from '@trpc/server';
import { cosineDistance, sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { IdSchema, similarity, SIMILARITY_THRESHOLD } from '../common';
import { SearchRecordsInputSchema } from '../records.types';
import type { IntegrationType, MediaType, RecordType } from '@/db/schema';
import { createEmbedding } from '@/lib/server/create-embedding';

export type SearchResult = {
	id: number;
	type: RecordType;
	title?: string | null;
	content?: string | null;
	summary?: string | null;
	sense?: string | null;
	abbreviation?: string | null;
	url?: string | null;
	avatarUrl?: string | null;
	rating: number;
	recordUpdatedAt: Date;
	recordCreatedAt: Date;
	contentCreatedAt?: Date | null;
	contentUpdatedAt?: Date | null;
	sources?: IntegrationType[] | null;
	mediaCaption?: string | null;
	media: {
		id: number;
		type: MediaType;
		url: string;
		altText?: string | null;
	}[];
	outgoingLinks: {
		id: number;
		predicate: {
			id: number;
		};
		target: {
			id: number;
			type: RecordType;
			title?: string | null;
			abbreviation?: string | null;
			sense?: string | null;
			summary?: string | null;
			avatarUrl?: string | null;
		};
	}[];
	similarity?: number;
};

export const byTextQuery = publicProcedure
	.input(SearchRecordsInputSchema)
	.query(({ ctx: { db }, input }): Promise<SearchResult[]> => {
		const {
			query,
			filters: { recordType },
			limit,
		} = input;
		return db.query.records.findMany({
			where: {
				RAW: (records, { sql }) =>
					sql`(
						${records.title} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.content} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.summary} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.abbreviation} <-> ${query} < ${SIMILARITY_THRESHOLD}
					)`,
				type: recordType,
			},
			limit,
			orderBy: (records, { desc, sql }) => [
				sql`LEAST(
					${records.title} <-> ${query},
					${records.content} <-> ${query},
					${records.summary} <-> ${query},
					${records.abbreviation} <-> ${query}
				)`,
				desc(records.recordUpdatedAt),
			],
			columns: {
				id: true,
				type: true,
				title: true,
				content: true,
				summary: true,
				sense: true,
				abbreviation: true,
				url: true,
				avatarUrl: true,
				mediaCaption: true,
				rating: true,
				recordUpdatedAt: true,
				recordCreatedAt: true,
				contentCreatedAt: true,
				contentUpdatedAt: true,
				sources: true,
				textEmbedding: false,
			},
			with: {
				outgoingLinks: {
					columns: {
						id: true,
					},
					with: {
						predicate: {
							columns: {
								id: true,
							},
						},
						target: {
							columns: {
								id: true,
								type: true,
								title: true,
								abbreviation: true,
								sense: true,
								summary: true,
								avatarUrl: true,
							},
						},
					},
					where: {
						predicate: {
							type: {
								in: ['containment', 'creation', 'description', 'identity'],
							},
						},
					},
				},
				media: {
					columns: {
						id: true,
						type: true,
						url: true,
						altText: true,
					},
				},
			},
		});
	});

export const similarityByQuery = publicProcedure
	.input(
		z.object({
			query: z.string(),
			limit: z.number().optional().default(20),
			exclude: z.number().array().optional(),
		})
	)
	.query(async ({ ctx: { db }, input }): Promise<SearchResult[]> => {
		try {
			const { query, limit, exclude } = input;

			const vector = await createEmbedding(query);

			const results = await db.query.records.findMany({
				columns: {
					id: true,
					type: true,
					title: true,
					content: true,
					summary: true,
					sense: true,
					abbreviation: true,
					url: true,
					avatarUrl: true,
					mediaCaption: true,
					rating: true,
					recordUpdatedAt: true,
					recordCreatedAt: true,
					contentCreatedAt: true,
					contentUpdatedAt: true,
					sources: true,
					textEmbedding: false,
				},
				with: {
					outgoingLinks: {
						columns: {
							id: true,
						},
						with: {
							predicate: {
								columns: {
									id: true,
								},
							},
							target: {
								columns: {
									id: true,
									type: true,
									title: true,
									abbreviation: true,
									sense: true,
									summary: true,
									avatarUrl: true,
								},
							},
						},
						where: {
							predicate: {
								type: {
									in: ['containment', 'creation', 'description', 'identity'],
								},
							},
						},
					},
					media: {
						columns: {
							id: true,
							type: true,
							url: true,
							altText: true,
						},
					},
				},
				extras: {
					similarity: (t) => similarity(t.textEmbedding, vector),
				},
				where: {
					AND: [
						{ textEmbedding: { isNotNull: true } },
						exclude?.length ? { id: { notIn: exclude } } : {},
						{ isPrivate: false },
						{
							OR: [
								{
									outgoingLinks: {
										predicate: {
											type: {
												ne: 'containment',
											},
										},
									},
								},
								{
									incomingLinks: {
										id: {
											isNotNull: true,
										},
									},
								},
							],
						},
					],
				},
				orderBy: (t, { desc }) => [desc(sql`similarity`), desc(t.recordUpdatedAt)],
				limit,
			});

			return results;
		} catch (err) {
			console.error(err);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for similar records',
			});
		}
	});

export const byRecordId = publicProcedure
	.input(
		z.object({
			id: IdSchema,
			limit: z.number().optional().default(10),
		})
	)
	.query(async ({ ctx: { db }, input: { id, limit } }) => {
		try {
			const recordWithLinks = await db.query.records.findFirst({
				columns: {
					id: true,
					textEmbedding: true,
				},
				where: {
					id,
				},
				with: {
					outgoingLinks: {
						columns: {
							targetId: true,
						},
					},
					incomingLinks: {
						columns: {
							sourceId: true,
						},
					},
				},
			});
			if (!recordWithLinks) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
			}
			const { textEmbedding, outgoingLinks, incomingLinks } = recordWithLinks;

			if (textEmbedding === null) {
				return [];
			}

			const omittedIds = [
				id,
				...outgoingLinks.map((l) => l.targetId),
				...incomingLinks.map((l) => l.sourceId),
			];

			const results = await db.query.records.findMany({
				columns: {
					id: true,
				},
				extras: {
					similarity: (t) => similarity(t.textEmbedding, textEmbedding),
				},
				where: {
					AND: [
						{ textEmbedding: { isNotNull: true } },
						{ id: { notIn: omittedIds } },
						{ isPrivate: false },
						{
							OR: [
								{
									RAW: (t, { sql }) =>
										sql`1 - (${cosineDistance(t.textEmbedding, textEmbedding)}) > ${SIMILARITY_THRESHOLD}`,
								},
								{
									outgoingLinks: {
										predicate: {
											type: {
												ne: 'containment',
											},
										},
									},
								},
								{
									incomingLinks: {
										id: {
											isNotNull: true,
										},
									},
								},
							],
						},
					],
				},
				orderBy: (t, { desc }) => [desc(sql`similarity`), desc(t.recordUpdatedAt)],
				limit,
			});

			return results;
		} catch (err) {
			console.error(err);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for similar records',
			});
		}
	});
