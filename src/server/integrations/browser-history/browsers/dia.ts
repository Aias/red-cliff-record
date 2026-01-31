import { BrowserSchema } from '@hozo';
import { createDiaConnection } from '@/server/db/connections/dia-sqlite';
import type { BrowserConfig } from '../types';

export const diaConfig: BrowserConfig = {
  name: BrowserSchema.enum.dia,
  displayName: 'Dia',
  createConnection: createDiaConnection,
  // Cutoff date for Dia browser (June 20, 2025)
  cutoffDate: new Date('2025-06-20'),
};
