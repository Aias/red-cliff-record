/**
 * Database types re-exported for frontend use
 * Frontend should import these instead of directly from @/db/schema
 */

// Re-export core types that frontend components need
export type {
	IntegrationType,
	LinkSelect,
	MediaSelect,
	MediaType,
	PredicateSelect,
	RecordInsert,
	RecordSelect,
	RecordType,
} from '@/server/db/schema';

// Re-export schemas that frontend needs for validation
export {
	IntegrationTypeSchema,
	MediaType as MediaTypeSchema,
	RecordInsertSchema,
	RecordTypeSchema,
} from '@/server/db/schema';

// Re-export constants that frontend needs
export { TEXT_EMBEDDING_DIMENSIONS } from '@/server/db/schema/operations';
