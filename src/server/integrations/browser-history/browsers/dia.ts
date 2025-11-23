import { createDiaConnection } from '@/server/db/connections/dia-sqlite';
import type { BrowserConfig } from '../types';
import { Browser } from '@aias/hozo';

export const diaConfig: BrowserConfig = {
	name: Browser.enum.dia,
	displayName: 'Dia',
	createConnection: createDiaConnection,
	// Cutoff date for Dia browser (June 20, 2025)
	cutoffDate: new Date('2025-06-20'),
};
