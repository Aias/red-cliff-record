-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `meta` (
	`key` numeric PRIMARY KEY NOT NULL,
	`value` numeric
);
--> statement-breakpoint
CREATE TABLE `urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`url` numeric,
	`title` numeric,
	`visit_count` integer DEFAULT 0 NOT NULL,
	`typed_count` integer DEFAULT 0 NOT NULL,
	`last_visit_time` integer NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `urls_url_index` ON `urls` (`url`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`url` integer NOT NULL,
	`visit_time` integer NOT NULL,
	`from_visit` integer,
	`external_referrer_url` text,
	`transition` integer DEFAULT 0 NOT NULL,
	`segment_id` integer,
	`visit_duration` integer DEFAULT 0 NOT NULL,
	`incremented_omnibox_typed_score` numeric DEFAULT (FALSE) NOT NULL,
	`opener_visit` integer,
	`originator_cache_guid` text,
	`originator_visit_id` integer,
	`originator_from_visit` integer,
	`originator_opener_visit` integer,
	`is_known_to_sync` numeric DEFAULT (FALSE) NOT NULL,
	`consider_for_ntp_most_visited` numeric DEFAULT (FALSE) NOT NULL,
	`visited_link_id` integer DEFAULT 0 NOT NULL,
	`app_id` text
);
--> statement-breakpoint
CREATE INDEX `visits_originator_id_index` ON `visits` (`originator_visit_id`);--> statement-breakpoint
CREATE INDEX `visits_time_index` ON `visits` (`visit_time`);--> statement-breakpoint
CREATE INDEX `visits_from_index` ON `visits` (`from_visit`);--> statement-breakpoint
CREATE INDEX `visits_url_index` ON `visits` (`url`);--> statement-breakpoint
CREATE TABLE `visit_source` (
	`id` integer PRIMARY KEY,
	`source` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `keyword_search_terms` (
	`keyword_id` integer NOT NULL,
	`url_id` integer NOT NULL,
	`term` numeric NOT NULL,
	`normalized_term` numeric NOT NULL
);
--> statement-breakpoint
CREATE INDEX `keyword_search_terms_index3` ON `keyword_search_terms` (`term`);--> statement-breakpoint
CREATE INDEX `keyword_search_terms_index2` ON `keyword_search_terms` (`url_id`);--> statement-breakpoint
CREATE INDEX `keyword_search_terms_index1` ON `keyword_search_terms` (`keyword_id`,`normalized_term`);--> statement-breakpoint
CREATE TABLE `downloads` (
	`id` integer PRIMARY KEY,
	`guid` text NOT NULL,
	`current_path` numeric NOT NULL,
	`target_path` numeric NOT NULL,
	`start_time` integer NOT NULL,
	`received_bytes` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`state` integer NOT NULL,
	`danger_type` integer NOT NULL,
	`interrupt_reason` integer NOT NULL,
	`hash` blob NOT NULL,
	`end_time` integer NOT NULL,
	`opened` integer NOT NULL,
	`last_access_time` integer NOT NULL,
	`transient` integer NOT NULL,
	`referrer` text NOT NULL,
	`site_url` text NOT NULL,
	`embedder_download_data` text NOT NULL,
	`tab_url` text NOT NULL,
	`tab_referrer_url` text NOT NULL,
	`http_method` text NOT NULL,
	`by_ext_id` text NOT NULL,
	`by_ext_name` text NOT NULL,
	`by_web_app_id` text NOT NULL,
	`etag` text NOT NULL,
	`last_modified` text NOT NULL,
	`mime_type` text(255) NOT NULL,
	`original_mime_type` text(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `downloads_url_chains` (
	`id` integer NOT NULL,
	`chain_index` integer NOT NULL,
	`url` numeric NOT NULL,
	PRIMARY KEY(`id`, `chain_index`)
);
--> statement-breakpoint
CREATE TABLE `downloads_slices` (
	`download_id` integer NOT NULL,
	`offset` integer NOT NULL,
	`received_bytes` integer NOT NULL,
	`finished` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`download_id`, `offset`)
);
--> statement-breakpoint
CREATE TABLE `segments` (
	`id` integer PRIMARY KEY,
	`name` text,
	`url_id` integer
);
--> statement-breakpoint
CREATE INDEX `segments_url_id` ON `segments` (`url_id`);--> statement-breakpoint
CREATE INDEX `segments_name` ON `segments` (`name`);--> statement-breakpoint
CREATE TABLE `segment_usage` (
	`id` integer PRIMARY KEY,
	`segment_id` integer NOT NULL,
	`time_slot` integer NOT NULL,
	`visit_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `segments_usage_seg_id` ON `segment_usage` (`segment_id`);--> statement-breakpoint
CREATE INDEX `segment_usage_time_slot_segment_id` ON `segment_usage` (`time_slot`,`segment_id`);--> statement-breakpoint
CREATE TABLE `content_annotations` (
	`visit_id` integer PRIMARY KEY,
	`visibility_score` numeric,
	`floc_protected_score` numeric,
	`categories` text,
	`page_topics_model_version` integer,
	`annotation_flags` integer NOT NULL,
	`entities` text,
	`related_searches` text,
	`search_normalized_url` text,
	`search_terms` numeric,
	`alternative_title` text,
	`page_language` text,
	`password_state` integer DEFAULT 0 NOT NULL,
	`has_url_keyed_image` numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE `context_annotations` (
	`visit_id` integer PRIMARY KEY,
	`context_annotation_flags` integer NOT NULL,
	`duration_since_last_visit` integer,
	`page_end_reason` integer,
	`total_foreground_duration` integer,
	`browser_type` integer DEFAULT 0 NOT NULL,
	`window_id` integer DEFAULT -1 NOT NULL,
	`tab_id` integer DEFAULT -1 NOT NULL,
	`task_id` integer DEFAULT -1 NOT NULL,
	`root_task_id` integer DEFAULT -1 NOT NULL,
	`parent_task_id` integer DEFAULT -1 NOT NULL,
	`response_code` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clusters` (
	`cluster_id` integer PRIMARY KEY AUTOINCREMENT,
	`should_show_on_prominent_ui_surfaces` numeric NOT NULL,
	`label` text NOT NULL,
	`raw_label` text NOT NULL,
	`triggerability_calculated` numeric NOT NULL,
	`originator_cache_guid` text NOT NULL,
	`originator_cluster_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clusters_and_visits` (
	`cluster_id` integer NOT NULL,
	`visit_id` integer NOT NULL,
	`score` numeric DEFAULT 0 NOT NULL,
	`engagement_score` numeric DEFAULT 0 NOT NULL,
	`url_for_deduping` numeric NOT NULL,
	`normalized_url` numeric NOT NULL,
	`url_for_display` numeric NOT NULL,
	`interaction_state` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`cluster_id`, `visit_id`)
);
--> statement-breakpoint
CREATE INDEX `clusters_for_visit` ON `clusters_and_visits` (`visit_id`);--> statement-breakpoint
CREATE TABLE `cluster_keywords` (
	`cluster_id` integer NOT NULL,
	`keyword` text NOT NULL,
	`type` integer NOT NULL,
	`score` numeric NOT NULL,
	`collections` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cluster_keywords_cluster_id_index` ON `cluster_keywords` (`cluster_id`);--> statement-breakpoint
CREATE TABLE `cluster_visit_duplicates` (
	`visit_id` integer NOT NULL,
	`duplicate_visit_id` integer NOT NULL,
	PRIMARY KEY(`visit_id`, `duplicate_visit_id`)
);
--> statement-breakpoint
CREATE TABLE `visited_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`link_url_id` integer NOT NULL,
	`top_level_url` numeric NOT NULL,
	`frame_url` numeric NOT NULL,
	`visit_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visited_links_index` ON `visited_links` (`link_url_id`,`top_level_url`,`frame_url`);--> statement-breakpoint
CREATE TABLE `history_sync_metadata` (
	`storage_key` integer PRIMARY KEY NOT NULL,
	`value` blob
);

*/