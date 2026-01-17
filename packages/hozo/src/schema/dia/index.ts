import { sql } from 'drizzle-orm';
import {
  blob,
  index,
  integer,
  numeric,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const meta = sqliteTable('meta', {
  key: numeric().primaryKey().notNull(),
  value: numeric(),
});

export const urls = sqliteTable(
  'urls',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    url: numeric(),
    title: numeric(),
    visitCount: integer('visit_count').default(0).notNull(),
    typedCount: integer('typed_count').default(0).notNull(),
    lastVisitTime: integer('last_visit_time').notNull(),
    hidden: integer().default(0).notNull(),
  },
  (table) => [index('urls_url_index').on(table.url)]
);

export const visits = sqliteTable(
  'visits',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    url: integer().notNull(),
    visitTime: integer('visit_time').notNull(),
    fromVisit: integer('from_visit'),
    externalReferrerUrl: text('external_referrer_url'),
    transition: integer().default(0).notNull(),
    segmentId: integer('segment_id'),
    visitDuration: integer('visit_duration').default(0).notNull(),
    incrementedOmniboxTypedScore: numeric('incremented_omnibox_typed_score')
      .default(sql`(FALSE)`)
      .notNull(),
    openerVisit: integer('opener_visit'),
    originatorCacheGuid: text('originator_cache_guid'),
    originatorVisitId: integer('originator_visit_id'),
    originatorFromVisit: integer('originator_from_visit'),
    originatorOpenerVisit: integer('originator_opener_visit'),
    isKnownToSync: numeric('is_known_to_sync')
      .default(sql`(FALSE)`)
      .notNull(),
    considerForNtpMostVisited: numeric('consider_for_ntp_most_visited')
      .default(sql`(FALSE)`)
      .notNull(),
    visitedLinkId: integer('visited_link_id').default(0).notNull(),
    appId: text('app_id'),
  },
  (table) => [
    index('visits_originator_id_index').on(table.originatorVisitId),
    index('visits_time_index').on(table.visitTime),
    index('visits_from_index').on(table.fromVisit),
    index('visits_url_index').on(table.url),
  ]
);

export const visitSource = sqliteTable('visit_source', {
  id: integer().primaryKey(),
  source: integer().notNull(),
});

export const keywordSearchTerms = sqliteTable(
  'keyword_search_terms',
  {
    keywordId: integer('keyword_id').notNull(),
    urlId: integer('url_id').notNull(),
    term: numeric().notNull(),
    normalizedTerm: numeric('normalized_term').notNull(),
  },
  (table) => [
    index('keyword_search_terms_index3').on(table.term),
    index('keyword_search_terms_index2').on(table.urlId),
    index('keyword_search_terms_index1').on(table.keywordId, table.normalizedTerm),
  ]
);

export const downloads = sqliteTable('downloads', {
  id: integer().primaryKey(),
  guid: text().notNull(),
  currentPath: numeric('current_path').notNull(),
  targetPath: numeric('target_path').notNull(),
  startTime: integer('start_time').notNull(),
  receivedBytes: integer('received_bytes').notNull(),
  totalBytes: integer('total_bytes').notNull(),
  state: integer().notNull(),
  dangerType: integer('danger_type').notNull(),
  interruptReason: integer('interrupt_reason').notNull(),
  hash: blob().notNull(),
  endTime: integer('end_time').notNull(),
  opened: integer().notNull(),
  lastAccessTime: integer('last_access_time').notNull(),
  transient: integer().notNull(),
  referrer: text().notNull(),
  siteUrl: text('site_url').notNull(),
  embedderDownloadData: text('embedder_download_data').notNull(),
  tabUrl: text('tab_url').notNull(),
  tabReferrerUrl: text('tab_referrer_url').notNull(),
  httpMethod: text('http_method').notNull(),
  byExtId: text('by_ext_id').notNull(),
  byExtName: text('by_ext_name').notNull(),
  byWebAppId: text('by_web_app_id').notNull(),
  etag: text().notNull(),
  lastModified: text('last_modified').notNull(),
  mimeType: text('mime_type', { length: 255 }).notNull(),
  originalMimeType: text('original_mime_type', { length: 255 }).notNull(),
});

export const downloadsUrlChains = sqliteTable(
  'downloads_url_chains',
  {
    id: integer().notNull(),
    chainIndex: integer('chain_index').notNull(),
    url: numeric().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.id, table.chainIndex],
      name: 'downloads_url_chains_id_chain_index_pk',
    }),
  ]
);

export const downloadsSlices = sqliteTable(
  'downloads_slices',
  {
    downloadId: integer('download_id').notNull(),
    offset: integer().notNull(),
    receivedBytes: integer('received_bytes').notNull(),
    finished: integer().default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.downloadId, table.offset],
      name: 'downloads_slices_download_id_offset_pk',
    }),
  ]
);

export const segments = sqliteTable(
  'segments',
  {
    id: integer().primaryKey(),
    name: text(),
    urlId: integer('url_id'),
  },
  (table) => [index('segments_url_id').on(table.urlId), index('segments_name').on(table.name)]
);

export const segmentUsage = sqliteTable(
  'segment_usage',
  {
    id: integer().primaryKey(),
    segmentId: integer('segment_id').notNull(),
    timeSlot: integer('time_slot').notNull(),
    visitCount: integer('visit_count').default(0).notNull(),
  },
  (table) => [
    index('segments_usage_seg_id').on(table.segmentId),
    index('segment_usage_time_slot_segment_id').on(table.timeSlot, table.segmentId),
  ]
);

export const contentAnnotations = sqliteTable('content_annotations', {
  visitId: integer('visit_id').primaryKey(),
  visibilityScore: numeric('visibility_score'),
  flocProtectedScore: numeric('floc_protected_score'),
  categories: text(),
  pageTopicsModelVersion: integer('page_topics_model_version'),
  annotationFlags: integer('annotation_flags').notNull(),
  entities: text(),
  relatedSearches: text('related_searches'),
  searchNormalizedUrl: text('search_normalized_url'),
  searchTerms: numeric('search_terms'),
  alternativeTitle: text('alternative_title'),
  pageLanguage: text('page_language'),
  passwordState: integer('password_state').default(0).notNull(),
  hasUrlKeyedImage: numeric('has_url_keyed_image').notNull(),
});

export const contextAnnotations = sqliteTable('context_annotations', {
  visitId: integer('visit_id').primaryKey(),
  contextAnnotationFlags: integer('context_annotation_flags').notNull(),
  durationSinceLastVisit: integer('duration_since_last_visit'),
  pageEndReason: integer('page_end_reason'),
  totalForegroundDuration: integer('total_foreground_duration'),
  browserType: integer('browser_type').default(0).notNull(),
  windowId: integer('window_id').default(-1).notNull(),
  tabId: integer('tab_id').default(-1).notNull(),
  taskId: integer('task_id').default(-1).notNull(),
  rootTaskId: integer('root_task_id').default(-1).notNull(),
  parentTaskId: integer('parent_task_id').default(-1).notNull(),
  responseCode: integer('response_code').default(0).notNull(),
});

export const clusters = sqliteTable('clusters', {
  clusterId: integer('cluster_id').primaryKey({ autoIncrement: true }),
  shouldShowOnProminentUiSurfaces: numeric('should_show_on_prominent_ui_surfaces').notNull(),
  label: text().notNull(),
  rawLabel: text('raw_label').notNull(),
  triggerabilityCalculated: numeric('triggerability_calculated').notNull(),
  originatorCacheGuid: text('originator_cache_guid').notNull(),
  originatorClusterId: integer('originator_cluster_id').notNull(),
});

export const clustersAndVisits = sqliteTable(
  'clusters_and_visits',
  {
    clusterId: integer('cluster_id').notNull(),
    visitId: integer('visit_id').notNull(),
    score: numeric().notNull(),
    engagementScore: numeric('engagement_score').notNull(),
    urlForDeduping: numeric('url_for_deduping').notNull(),
    normalizedUrl: numeric('normalized_url').notNull(),
    urlForDisplay: numeric('url_for_display').notNull(),
    interactionState: integer('interaction_state').default(0).notNull(),
  },
  (table) => [
    index('clusters_for_visit').on(table.visitId),
    primaryKey({
      columns: [table.clusterId, table.visitId],
      name: 'clusters_and_visits_cluster_id_visit_id_pk',
    }),
  ]
);

export const clusterKeywords = sqliteTable(
  'cluster_keywords',
  {
    clusterId: integer('cluster_id').notNull(),
    keyword: text().notNull(),
    type: integer().notNull(),
    score: numeric().notNull(),
    collections: text().notNull(),
  },
  (table) => [index('cluster_keywords_cluster_id_index').on(table.clusterId)]
);

export const clusterVisitDuplicates = sqliteTable(
  'cluster_visit_duplicates',
  {
    visitId: integer('visit_id').notNull(),
    duplicateVisitId: integer('duplicate_visit_id').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.visitId, table.duplicateVisitId],
      name: 'cluster_visit_duplicates_visit_id_duplicate_visit_id_pk',
    }),
  ]
);

export const visitedLinks = sqliteTable(
  'visited_links',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    linkUrlId: integer('link_url_id').notNull(),
    topLevelUrl: numeric('top_level_url').notNull(),
    frameUrl: numeric('frame_url').notNull(),
    visitCount: integer('visit_count').default(0).notNull(),
  },
  (table) => [index('visited_links_index').on(table.linkUrlId, table.topLevelUrl, table.frameUrl)]
);

export const historySyncMetadata = sqliteTable('history_sync_metadata', {
  storageKey: integer('storage_key').primaryKey().notNull(),
  value: blob(),
});
