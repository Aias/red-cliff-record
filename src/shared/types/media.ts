import type { MediaType } from '@hozo';

/**
 * Media-related types used across client and server
 */

export type MediaMetadata = {
  mediaType: MediaType;
  mediaFormat: string;
  contentTypeString: string;
  size?: number;
  width?: number;
  height?: number;
  format?: string;
  hasAlpha?: boolean;
};
