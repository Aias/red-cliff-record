import { Browser } from '@rcr/data/browser-history';
import { createArcConnection } from '@/server/db/connections/arc-sqlite';
import type { BrowserConfig } from '../types';

export const arcConfig: BrowserConfig = {
	name: Browser.enum.arc,
	displayName: 'Arc',
	createConnection: createArcConnection,
};
