import { copyFileSync } from 'fs';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';
import { arcSchema } from '@aias/hozo';

const arcHistoryPath = 'Library/Application Support/Arc/User Data/Default/History';

// Path to Arc's History database (Mac OS Only)
export const arcDbPath = join(homedir(), arcHistoryPath);
export const arcDbCopyPath = join(homedir(), `${arcHistoryPath}-copy`);
export const connectionUrl = `file:${arcDbCopyPath}`;

export const createArcConnection = () => {
	if (!existsSync(arcDbPath)) {
		throw new BrowserNotInstalledError('Arc', arcDbPath);
	}
	copyFileSync(arcDbPath, arcDbCopyPath);

	const client = createClient({
		url: connectionUrl,
		intMode: 'bigint',
	});

	return drizzle(client, { schema: arcSchema });
};
