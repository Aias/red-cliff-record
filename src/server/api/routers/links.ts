import {
  LinkInsertSchema,
  links,
  type LinkInsert,
  type LinkSelect,
  type PredicateSelect,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { RecordLinks, RecordLinksMap } from '@/shared/types';
import { IdSchema, type DbId } from '@/shared/types';
import { createTRPCRouter, publicProcedure } from '../init';

export const linksRouter = createTRPCRouter({
  /**
   * Get all incoming and outgoing links for a specific record
   *
   * @param id - Record ID to fetch links for
   * @returns Object containing the record ID and arrays of incoming/outgoing links
   * @throws NOT_FOUND if record doesn't exist
   *
   * Used by: Record detail views, relationship components
   */
  listForRecord: publicProcedure
    .input(z.object({ id: IdSchema }))
    .query(async ({ ctx: { db }, input }): Promise<RecordLinks> => {
      const recordWithLinks = await db.query.records.findFirst({
        columns: {
          id: true,
        },
        where: {
          id: input.id,
        },
        with: {
          outgoingLinks: {
            columns: {
              id: true,
              sourceId: true,
              targetId: true,
              predicateId: true,
              recordUpdatedAt: true,
            },
          },
          incomingLinks: {
            columns: {
              id: true,
              sourceId: true,
              targetId: true,
              predicateId: true,
              recordUpdatedAt: true,
            },
          },
        },
      });
      if (!recordWithLinks) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
      }

      return recordWithLinks;
    }),

  /**
   * Get a map of links for multiple records in a single query
   *
   * @param recordIds - Array of record IDs to fetch links for (minimum 1)
   * @returns Map where keys are record IDs and values are RecordLinks objects
   *
   * Efficiently fetches all links where any of the provided record IDs appear
   * as either source or target. Useful for bulk operations and tree structures.
   *
   * Used by: Tree views, bulk relationship operations, record grids
   */
  map: publicProcedure
    .input(z.object({ recordIds: z.array(IdSchema).min(1) }))
    .query(async ({ ctx: { db }, input: { recordIds } }): Promise<RecordLinksMap> => {
      const rows = await db.query.links.findMany({
        columns: {
          id: true,
          sourceId: true,
          targetId: true,
          predicateId: true,
          recordUpdatedAt: true,
        },
        with: {
          predicate: {
            columns: {
              id: true,
              type: true,
            },
          },
        },
        where: {
          OR: [
            {
              sourceId: {
                in: recordIds,
              },
            },
            {
              targetId: {
                in: recordIds,
              },
            },
          ],
        },
      });

      /* shape:  { 7: { outgoing:[], incoming:[] }, 42: { … } } */
      const map: Record<DbId, RecordLinks> = {};

      for (const row of rows) {
        /* outgoing for sourceId */
        (map[row.sourceId] ??= {
          outgoingLinks: [],
          incomingLinks: [],
          id: row.sourceId,
        }).outgoingLinks.push(row);
        /* incoming for targetId (if different) */
        if (row.targetId !== row.sourceId) {
          (map[row.targetId] ??= {
            outgoingLinks: [],
            incomingLinks: [],
            id: row.targetId,
          }).incomingLinks.push(row);
        }
      }
      return map;
    }),

  /**
   * Create or update a relationship link between two records
   *
   * @param input - Link data including sourceId, targetId, predicateId, and optional notes
   * @returns The created or updated link
   * @throws NOT_FOUND if predicate doesn't exist
   * @throws BAD_REQUEST if predicate is non-canonical and not reversible, or if sourceId equals targetId
   * @throws INTERNAL_SERVER_ERROR if database operation fails
   *
   * Features:
   * - Automatically handles predicate canonicalization (flips source/target if needed)
   * - Prevents self-links (sourceId === targetId)
   * - Updates existing links or creates new ones based on unique constraint
   * - Supports both INSERT and UPDATE operations via optional ID
   *
   * Used by: Relationship creation/editing, record linking interfaces
   */
  upsert: publicProcedure.input(LinkInsertSchema).mutation(async ({ ctx: { db }, input }) => {
    /* 1 ─ fetch predicate + inverse */
    const predicate = await db.query.predicates.findFirst({
      where: { id: input.predicateId },
      with: { inverse: true },
    });
    if (!predicate) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Predicate not found' });
    }

    /* 2 ─ compute canonical direction */
    let { sourceId, targetId, predicateId } = input;
    if (!predicate.canonical) {
      const inv = predicate.inverse;
      if (!inv?.canonical) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Non-canonical predicate is not reversible',
        });
      }
      sourceId = input.targetId;
      targetId = input.sourceId;
      predicateId = inv.id;
    }

    if (sourceId === targetId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'sourceId and targetId cannot be identical',
      });
    }

    const now = new Date();

    /* 3 ─ build write payload with only safe fields                */
    const linkData = {
      sourceId,
      targetId,
      predicateId,
      notes: input.notes ?? null,
      recordUpdatedAt: now,
    } satisfies Partial<LinkInsert>;

    let row: LinkSelect | undefined;

    if (input.id) {
      /* UPDATE --------------------------------------------------- */
      [row] = await db.update(links).set(linkData).where(eq(links.id, input.id)).returning();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found for update' });
      }
    } else {
      /* INSERT … ON CONFLICT ------------------------------------ */
      [row] = await db
        .insert(links)
        .values(linkData)
        .onConflictDoUpdate({
          target: [links.sourceId, links.targetId, links.predicateId],
          set: { ...linkData, recordUpdatedAt: now },
        })
        .returning();
      if (!row) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to insert or update link',
        });
      }
    }

    if (!row) {
      // This case should theoretically be unreachable due to checks above,
      // but included for exhaustive handling.
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to obtain result from upsert operation',
      });
    }

    return row;
  }),

  /**
   * Get all available relationship predicates
   *
   * @returns Array of all predicate definitions
   *
   * Predicates define the types of relationships that can exist between records
   * (e.g., "contains", "created by", "similar to"). Used to populate relationship
   * type selectors and validate relationship creation.
   *
   * Used by: Relationship creation forms, predicate selectors
   */
  listPredicates: publicProcedure.query(async ({ ctx: { db } }): Promise<PredicateSelect[]> => {
    const predicates = await db.query.predicates.findMany();
    return predicates;
  }),

  /**
   * Delete multiple links by their IDs
   *
   * @param input - Array of link IDs to delete
   * @returns Array of deleted link records
   *
   * Performs bulk deletion of relationship links. Returns the actual deleted
   * records for confirmation and potential rollback scenarios.
   *
   * Used by: Relationship management, bulk operations, cleanup processes
   */
  delete: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
    if (input.length === 0) {
      return []; // Return empty array if input is empty
    }
    const deletedLinks = await db.delete(links).where(inArray(links.id, input)).returning();
    return deletedLinks;
  }),
});
