import type { GithubCommitSelect } from '@hozo';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DateSchema } from '@/shared/types/api';
import { adminProcedure, createTRPCRouter } from '../init';

const CommitSummarySchema = z.object({
  id: z.string(),
  time: z.string(),
  repo: z.string(),
  type: z.string().nullable(),
  message: z.string(),
  summary: z.string().nullable(),
  technologies: z.array(z.string()).nullable(),
  additions: z.number().nullable(),
  deletions: z.number().nullable(),
});

const DailySummarySchema = z.object({
  date: z.string(),
  commits: z.array(CommitSummarySchema),
});

export type CommitSummary = z.infer<typeof CommitSummarySchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;

function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0] ?? '';
}

function processCommit(
  commit: GithubCommitSelect & { repository: { fullName: string } | null }
): CommitSummary {
  return {
    id: commit.id,
    time: commit.committedAt ? formatTime(commit.committedAt) : '',
    repo: commit.repository?.fullName ?? 'unknown',
    type: commit.commitType,
    message: commit.message,
    summary: commit.summary,
    technologies: commit.technologies,
    additions: commit.additions,
    deletions: commit.deletions,
  };
}

export const githubRouter = createTRPCRouter({
  /**
   * Get daily commit summary
   */
  dailySummary: adminProcedure
    .input(z.object({ date: DateSchema }))
    .query(async ({ ctx: { db }, input: { date } }): Promise<DailySummary> => {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59.999`);

      const commits = await db.query.githubCommits.findMany({
        where: {
          committedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        with: {
          repository: {
            columns: {
              fullName: true,
            },
          },
        },
        orderBy: {
          committedAt: 'asc',
        },
      });

      return {
        date,
        commits: commits.map(processCommit),
      };
    }),

  /**
   * Get a single commit by ID with full details including file changes
   */
  getCommit: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      const commit = await db.query.githubCommits.findFirst({
        where: {
          id,
        },
        with: {
          repository: {
            columns: {
              id: true,
              fullName: true,
              htmlUrl: true,
              description: true,
            },
          },
          commitChanges: {
            columns: {
              id: true,
              filename: true,
              status: true,
              additions: true,
              deletions: true,
              changes: true,
              patch: true,
            },
          },
        },
      });

      if (!commit) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Commit not found' });
      }

      return commit;
    }),
});
