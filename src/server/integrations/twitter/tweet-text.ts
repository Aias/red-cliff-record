import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('twitter', 'tweet-text');

export type KnownTweetIds = Set<string>;

export type UrlResolver = (url: string) => Promise<string>;

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

const resolvedUrlCache = new Map<string, string>();

/**
 * Collapse all whitespace (including newlines) to single spaces.
 * Used for comparison purposes only.
 */
export const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Normalize whitespace while preserving newlines.
 * - Collapses multiple spaces/tabs to single space
 * - Trims each line
 * - Collapses multiple consecutive newlines to double newline
 * - Trims the whole string
 */
export const normalizeWhitespace = (value: string): string => {
  return value
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // collapse 3+ newlines to 2
    .trim();
};

export const createUrlResolver = (): UrlResolver => {
  return async (url: string): Promise<string> => {
    const cached = resolvedUrlCache.get(url);
    if (cached) {
      return cached;
    }

    try {
      const headResponse = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (headResponse.ok && headResponse.url) {
        resolvedUrlCache.set(url, headResponse.url);
        return headResponse.url;
      }

      const getResponse = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (getResponse.url) {
        resolvedUrlCache.set(url, getResponse.url);
        return getResponse.url;
      }
    } catch (error) {
      logger.warn(`Failed to resolve URL ${url}`, error);
    }

    resolvedUrlCache.set(url, url);
    return url;
  };
};

const parseTweetId = (url: URL): string | null => {
  const statusIdMatch = url.pathname.match(/status\/(\d+)/);
  if (statusIdMatch?.[1]) {
    return statusIdMatch[1];
  }

  const directIdMatch = url.pathname.match(/\/i\/web\/status\/(\d+)/);
  if (directIdMatch?.[1]) {
    return directIdMatch[1];
  }

  return null;
};

const isTweetHost = (host: string): boolean =>
  host === 'twitter.com' ||
  host === 'x.com' ||
  host.endsWith('.twitter.com') ||
  host.endsWith('.x.com');

export const isKnownTweetLink = (link: string, knownTweetIds: KnownTweetIds): boolean => {
  try {
    const parsed = new URL(link);
    if (!isTweetHost(parsed.hostname)) {
      return false;
    }

    const tweetId = parseTweetId(parsed);
    return Boolean(tweetId && knownTweetIds.has(tweetId));
  } catch (error) {
    logger.warn(`Failed to parse URL ${link}`, error);
    return false;
  }
};

const removeUrlFromText = (text: string, url: string): string => {
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleaned = text.replace(new RegExp(escapedUrl, 'g'), ' ');
  return normalizeWhitespace(cleaned);
};

export interface NormalizeOptions {
  /** Additional tweet IDs to treat as "known" (e.g., quoted tweet ID) */
  additionalKnownIds?: string[];
}

export const normalizeTweetContent = async (
  rawText: string,
  knownTweetIds: KnownTweetIds,
  resolveUrl: UrlResolver,
  options: NormalizeOptions = {}
): Promise<string> => {
  if (!rawText) {
    return '';
  }

  // Merge additional IDs (like quoted tweet) into the known set
  const effectiveKnownIds =
    options.additionalKnownIds && options.additionalKnownIds.length > 0
      ? new Set([...knownTweetIds, ...options.additionalKnownIds])
      : knownTweetIds;

  let normalized = rawText;
  const matches = Array.from(rawText.matchAll(URL_PATTERN)).map((match) => match[0]);
  if (matches.length === 0) {
    return normalizeWhitespace(normalized);
  }

  const resolutions = await Promise.all(
    matches.map(async (original) => ({
      original,
      resolved: await resolveUrl(original),
    }))
  );

  for (const { original, resolved } of resolutions) {
    if (isKnownTweetLink(resolved, effectiveKnownIds)) {
      normalized = removeUrlFromText(normalized, original);
      continue;
    }

    if (resolved !== original) {
      normalized = normalized.replaceAll(original, resolved);
    }
  }

  return normalizeWhitespace(normalized);
};

export const stripUrls = (text: string): string =>
  collapseWhitespace(text.replace(URL_PATTERN, ' '));

export const loadKnownTweetIds = async (): Promise<KnownTweetIds> => {
  const tweets = await db.query.twitterTweets.findMany({
    columns: { id: true },
    where: { deletedAt: { isNull: true } },
  });

  return new Set(tweets.map((tweet) => tweet.id));
};

export const fetchTweetTextById = async (tweetId: string): Promise<string | null> => {
  const tweet = await db.query.twitterTweets.findFirst({
    columns: { text: true },
    where: { id: tweetId },
  });

  return tweet?.text ?? null;
};
