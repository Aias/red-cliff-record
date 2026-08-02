import { boolean, enumeration, number, string } from '@rocicorp/zero';
import { drizzleZeroConfig } from 'drizzle-zero';
import { relations, schema, type MediaType, type RecordType } from './packages/hozo/src';

/**
 * Zero syncs the core entity graph only. Embedding vectors and the generated
 * full-text search document stay server-side (large, and only consumed by
 * server-computed queries).
 *
 * Columns that are NOT NULL with a database default are overridden with
 * explicit non-optional builders: drizzle-zero marks defaulted columns
 * optional (insert ergonomics), which would widen every read type with null.
 * Mutators always set these values explicitly.
 */
export default drizzleZeroConfig(
  { ...schema, relations },
  {
    tables: {
      records: {
        id: true,
        slug: true,
        type: enumeration<RecordType>(),
        title: true,
        sense: true,
        abbreviation: true,
        url: true,
        avatarUrl: true,
        summary: true,
        content: true,
        notes: true,
        mediaCaption: true,
        eloScore: number().from('elo_score'),
        isPrivate: boolean().from('is_private'),
        isCurated: boolean().from('is_curated'),
        reminderAt: true,
        sources: true,
        textSearch: false,
        textEmbedding: false,
        textEmbeddedAt: true,
        recordCreatedAt: number().from('created_at'),
        recordUpdatedAt: number().from('updated_at'),
        contentCreatedAt: true,
        contentUpdatedAt: true,
      },
      links: {
        id: true,
        sourceId: true,
        targetId: true,
        predicate: true,
        notes: true,
        recordCreatedAt: number().from('created_at'),
        recordUpdatedAt: number().from('updated_at'),
      },
      eloMatchups: {
        id: true,
        recordAId: true,
        recordBId: true,
        winnerId: true,
        recordType: true,
        recordCreatedAt: number().from('created_at'),
      },
      media: {
        id: true,
        recordId: true,
        url: true,
        altText: true,
        altTextGeneratedAt: true,
        type: enumeration<MediaType>(),
        format: string(),
        contentTypeString: string().from('content_type_string'),
        fileSize: true,
        width: true,
        height: true,
        versionOfMediaId: true,
        recordCreatedAt: number().from('created_at'),
        recordUpdatedAt: number().from('updated_at'),
      },
    },
  }
);
