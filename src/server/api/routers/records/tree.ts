import { containmentPredicateSlugs } from '@hozo';
import { TRPCError } from '@trpc/server';
import { IdParamSchema } from '@/shared/types/api';
import { publicProcedure } from '../../init';

export const getFamilyTree = publicProcedure
  .input(IdParamSchema)
  .query(async ({ ctx: { db }, input: { id } }) => {
    const family = await db.query.records.findFirst({
      where: {
        id,
      },
      columns: {
        id: true,
        title: true,
        recordCreatedAt: true,
      },
      with: {
        outgoingLinks: {
          where: {
            predicate: {
              in: containmentPredicateSlugs,
            },
          },
          columns: {
            predicate: true,
          },
          with: {
            target: {
              columns: {
                id: true, // Parent
                title: true,
                recordCreatedAt: true,
              },
              with: {
                outgoingLinks: {
                  where: {
                    predicate: {
                      in: containmentPredicateSlugs,
                    },
                  },
                  columns: {
                    predicate: true,
                  },
                  with: {
                    target: {
                      columns: {
                        id: true, // Grandparent
                        title: true,
                        recordCreatedAt: true,
                      },
                    },
                  },
                },
                incomingLinks: {
                  where: {
                    predicate: {
                      in: containmentPredicateSlugs,
                    },
                  },
                  columns: {
                    predicate: true,
                  },
                  with: {
                    source: {
                      columns: {
                        id: true, // Siblings
                        title: true,
                        recordCreatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        incomingLinks: {
          where: {
            predicate: {
              in: containmentPredicateSlugs,
            },
          },
          columns: {
            predicate: true,
          },
          with: {
            source: {
              columns: {
                id: true, // Children
                title: true,
                recordCreatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!family) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Family tree: Record ${id} not found`,
      });
    }

    return family;
  });

export type FamilyTree = Awaited<ReturnType<typeof getFamilyTree>>;
