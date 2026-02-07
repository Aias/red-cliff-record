import { browsingHistoryOmitList, BrowsingHistoryOmitListInsertSchema } from '@hozo';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DateSchema } from '@/shared/types/api';
import { adminProcedure, createTRPCRouter } from '../init';

const OverviewSchema = z.object({
  date: z.string(),
  pageViews: z.number(),
  uniqueDomains: z.number(),
  firstActivity: z.string().nullable(),
  lastActivity: z.string().nullable(),
  totalMinutes: z.number(),
  sessionCount: z.number(),
});

const TopDomainSchema = z.object({
  domain: z.string(),
  visits: z.number(),
  minutes: z.number(),
});

const SessionSchema = z.object({
  sessionNum: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  pageViews: z.number(),
  domains: z.array(z.string()),
  minutes: z.number(),
});

const SearchSchema = z.object({
  query: z.string(),
  occurrences: z.number(),
});

const NotablePageSchema = z.object({
  title: z.string(),
  domain: z.string(),
  firstVisited: z.string(),
  minutes: z.number(),
  visits: z.number(),
});

const DailySummarySchema = z.object({
  overview: OverviewSchema,
  topDomains: z.array(TopDomainSchema),
  sessions: z.array(SessionSchema),
  searches: z.array(SearchSchema),
  notablePages: z.array(NotablePageSchema),
});

export type DailySummary = z.infer<typeof DailySummarySchema>;

// Session gap threshold in milliseconds (30 minutes)
const SESSION_GAP_MS = 30 * 60 * 1000;

function extractDomain(url: string): string {
  try {
    const withoutProtocol = url.replace(/^[a-z]+:\/\//, '');
    const domain = withoutProtocol.split('/')[0] ?? '';
    return domain.split(':')[0] ?? domain; // Remove port if present
  } catch {
    return '';
  }
}

function isLocalhost(domain: string): boolean {
  return (
    domain.startsWith('localhost') ||
    domain.startsWith('127.0.0.1') ||
    domain.startsWith('0.0.0.0') ||
    domain.startsWith('192.168.') ||
    domain.startsWith('10.')
  );
}

function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0] ?? '';
}

function matchesOmitPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert SQL LIKE pattern to regex
    const regexPattern = pattern
      // Escape regex metacharacters first, then expand LIKE wildcards.
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    try {
      return new RegExp(regexPattern).test(url);
    } catch {
      return false;
    }
  });
}

interface BrowsingEntry {
  id: number;
  viewTime: Date;
  url: string;
  pageTitle: string | null;
  viewDuration: number | null;
  searchTerms: string | null;
}

function processBrowsingData(entries: BrowsingEntry[], date: string): DailySummary {
  if (entries.length === 0) {
    return createEmptySummary(date);
  }

  // Sort by view time
  const sorted = [...entries].sort((a, b) => a.viewTime.getTime() - b.viewTime.getTime());

  // Add domain to each entry
  const withDomains = sorted.map((entry) => ({
    ...entry,
    domain: extractDomain(entry.url),
  }));

  // Assign sessions based on time gaps
  let currentSession = 1;
  const withSessions = withDomains.map((entry, i) => {
    if (i > 0) {
      const prevEntry = withDomains[i - 1];
      if (prevEntry) {
        const gap = entry.viewTime.getTime() - prevEntry.viewTime.getTime();
        if (gap > SESSION_GAP_MS) {
          currentSession++;
        }
      }
    }
    return { ...entry, sessionNum: currentSession };
  });

  // Compute overview
  const firstEntry = withSessions[0];
  const lastEntry = withSessions[withSessions.length - 1];
  const uniqueDomains = new Set(withSessions.map((e) => e.domain)).size;
  const totalMinutes = Math.floor(
    withSessions.reduce((sum, e) => sum + (e.viewDuration ?? 0), 0) / 60
  );
  const sessionCount = currentSession;

  const overview: z.infer<typeof OverviewSchema> = {
    date,
    pageViews: withSessions.length,
    uniqueDomains,
    firstActivity: firstEntry ? formatTime(firstEntry.viewTime) : null,
    lastActivity: lastEntry ? formatTime(lastEntry.viewTime) : null,
    totalMinutes,
    sessionCount,
  };

  // Compute top domains
  const domainStats = new Map<string, { visits: number; minutes: number }>();
  for (const entry of withSessions) {
    const stats = domainStats.get(entry.domain) ?? { visits: 0, minutes: 0 };
    stats.visits++;
    stats.minutes += Math.floor((entry.viewDuration ?? 0) / 60);
    domainStats.set(entry.domain, stats);
  }
  const topDomains = [...domainStats.entries()]
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  // Compute sessions
  const sessionStats = new Map<
    number,
    {
      startTime: Date;
      endTime: Date;
      pageViews: number;
      domains: Set<string>;
      minutes: number;
    }
  >();
  for (const entry of withSessions) {
    const stats = sessionStats.get(entry.sessionNum) ?? {
      startTime: entry.viewTime,
      endTime: entry.viewTime,
      pageViews: 0,
      domains: new Set<string>(),
      minutes: 0,
    };
    if (entry.viewTime < stats.startTime) stats.startTime = entry.viewTime;
    if (entry.viewTime > stats.endTime) stats.endTime = entry.viewTime;
    stats.pageViews++;
    stats.domains.add(entry.domain);
    stats.minutes += Math.floor((entry.viewDuration ?? 0) / 60);
    sessionStats.set(entry.sessionNum, stats);
  }
  const sessions = [...sessionStats.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sessionNum, stats]) => ({
      sessionNum,
      startTime: formatTime(stats.startTime),
      endTime: formatTime(stats.endTime),
      pageViews: stats.pageViews,
      domains: [...stats.domains],
      minutes: stats.minutes,
    }));

  // Compute searches
  const searchCounts = new Map<string, number>();
  for (const entry of withSessions) {
    if (entry.searchTerms) {
      const count = searchCounts.get(entry.searchTerms) ?? 0;
      searchCounts.set(entry.searchTerms, count + 1);
    }
  }
  const searches = [...searchCounts.entries()]
    .map(([query, occurrences]) => ({ query, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 15);

  // Compute notable pages (pages with ≥1 min view time)
  const pageStats = new Map<
    string,
    {
      title: string;
      domain: string;
      firstVisited: Date;
      minutes: number;
      visits: number;
    }
  >();
  for (const entry of withSessions) {
    if (!entry.pageTitle) continue;
    const key = `${entry.pageTitle}|${entry.domain}`;
    const stats = pageStats.get(key) ?? {
      title: entry.pageTitle,
      domain: entry.domain,
      firstVisited: entry.viewTime,
      minutes: 0,
      visits: 0,
    };
    if (entry.viewTime < stats.firstVisited) {
      stats.firstVisited = entry.viewTime;
    }
    stats.minutes += Math.floor((entry.viewDuration ?? 0) / 60);
    stats.visits++;
    pageStats.set(key, stats);
  }
  const notablePages = [...pageStats.values()]
    .filter((p) => p.minutes >= 1)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 15)
    .map((p) => ({
      title: p.title,
      domain: p.domain,
      firstVisited: formatTime(p.firstVisited),
      minutes: p.minutes,
      visits: p.visits,
    }));

  return {
    overview,
    topDomains,
    sessions,
    searches,
    notablePages,
  };
}

function createEmptySummary(date: string): DailySummary {
  return {
    overview: {
      date,
      pageViews: 0,
      uniqueDomains: 0,
      firstActivity: null,
      lastActivity: null,
      totalMinutes: 0,
      sessionCount: 0,
    },
    topDomains: [],
    sessions: [],
    searches: [],
    notablePages: [],
  };
}

export const browsingRouter = createTRPCRouter({
  dailySummary: adminProcedure
    .input(z.object({ date: DateSchema }))
    .query(async ({ ctx: { db }, input: { date } }): Promise<DailySummary> => {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59.999`);

      // Fetch omit patterns
      const omitPatterns = await db.query.browsingHistoryOmitList.findMany({
        columns: { pattern: true },
      });
      const patterns = omitPatterns.map((p) => p.pattern);

      // Fetch browsing history for the day
      const entries = await db.query.browsingHistory.findMany({
        columns: {
          id: true,
          viewTime: true,
          url: true,
          pageTitle: true,
          viewDuration: true,
          searchTerms: true,
        },
        where: {
          viewTime: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: (t, { asc }) => asc(t.viewTime),
      });

      // Filter entries based on omit patterns and localhost
      const filtered = entries.filter((entry) => {
        const domain = extractDomain(entry.url);
        if (isLocalhost(domain)) return false;
        if (matchesOmitPattern(entry.url, patterns)) return false;
        return true;
      });

      return processBrowsingData(filtered, date);
    }),

  /**
   * List all URL patterns in the browsing history omit list
   */
  listOmitPatterns: adminProcedure.query(async ({ ctx: { db } }): Promise<string[]> => {
    const rows = await db.query.browsingHistoryOmitList.findMany({
      columns: { pattern: true },
      orderBy: { pattern: 'asc' },
    });
    return rows.map((row) => row.pattern);
  }),

  /**
   * Add or update a pattern in the browsing history omit list
   *
   * Patterns use SQL LIKE syntax (% for wildcard, _ for single character)
   */
  upsertOmitPattern: adminProcedure
    .input(BrowsingHistoryOmitListInsertSchema)
    .mutation(async ({ ctx: { db }, input }) => {
      const now = new Date();
      const [row] = await db
        .insert(browsingHistoryOmitList)
        .values({ pattern: input.pattern, recordCreatedAt: now, recordUpdatedAt: now })
        .onConflictDoUpdate({
          target: browsingHistoryOmitList.pattern,
          set: { recordUpdatedAt: now },
        })
        .returning();
      return row;
    }),

  /**
   * Delete patterns from the browsing history omit list
   */
  deleteOmitPatterns: adminProcedure
    .input(z.array(z.string().min(1)))
    .mutation(async ({ ctx: { db }, input }) => {
      if (input.length === 0) {
        return [];
      }
      return db
        .delete(browsingHistoryOmitList)
        .where(inArray(browsingHistoryOmitList.pattern, input))
        .returning();
    }),
});
