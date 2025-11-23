import { copyFileSync } from 'fs';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';
import { diaSchema } from '@aias/hozo';

const diaHistoryPath = 'Library/Application Support/Dia/User Data/Default/History';

// Path to Dia's History database (Mac OS Only)
export const diaDbPath = join(homedir(), diaHistoryPath);
export const diaDbCopyPath = join(homedir(), `${diaHistoryPath}-copy`);
export const connectionUrl = `file:${diaDbCopyPath}`;

export const createDiaConnection = () => {
	if (!existsSync(diaDbPath)) {
		throw new BrowserNotInstalledError('Dia', diaDbPath);
	}
	copyFileSync(diaDbPath, diaDbCopyPath);

	const client = createClient({
		url: connectionUrl,
		intMode: 'bigint',
	});

	return drizzle(client, { schema: diaSchema });
};
