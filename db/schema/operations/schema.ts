import { pgSchema } from 'drizzle-orm/pg-core';
import { IntegrationType } from './types';

export const operationsSchema = pgSchema('operations');

export const integrationTypeEnum = operationsSchema.enum(
	'integration_type',
	IntegrationType.options
);
