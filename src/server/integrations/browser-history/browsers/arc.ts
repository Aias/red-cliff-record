import { createArcConnection } from '@/server/db/connections/arc-sqlite';
import type { BrowserConfig } from '../types';
import { Browser } from '@/db/schema/browser-history';

export const arcConfig: BrowserConfig = {
	name: Browser.enum.arc,
	displayName: 'Arc',
	createConnection: createArcConnection,
};
