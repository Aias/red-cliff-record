import { z } from 'zod';

export const integrationStatuses = ['success', 'fail', 'in_progress'] as const;
export const IntegrationStatusSchema = z.enum(integrationStatuses);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
// Backward-compatible alias for runtime use
export { IntegrationStatusSchema as IntegrationStatus };

export const integrationTypes = [
  'ai_chat',
  'airtable',
  'browser_history',
  'crawler',
  'embeddings',
  'feedbin',
  'github',
  'lightroom',
  'manual',
  'raindrop',
  'readwise',
  'twitter',
] as const;
export const IntegrationTypeSchema = z.enum(integrationTypes);
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;

export const runTypes = ['seed', 'sync'] as const;
export const RunTypeSchema = z.enum(runTypes);
export type RunType = z.infer<typeof RunTypeSchema>;
// Backward-compatible alias for runtime use
export { RunTypeSchema as RunType };

export const TEXT_EMBEDDING_DIMENSIONS = 768;
