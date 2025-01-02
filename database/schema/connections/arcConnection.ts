import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as schema from '../arc';

const arcHistoryPath = 'Library/Application Support/Arc/User Data/Default/History';

// Path to Arc's History database (Mac OS Only)
export const arcDbPath = join(homedir(), arcHistoryPath);
export const arcDbCopyPath = join(homedir(), `${arcHistoryPath}-copy`);

export const createArcConnection = () => {
	copyFileSync(arcDbPath, arcDbCopyPath);

	const client = createClient({
		url: `file:${arcDbCopyPath}`,
		intMode: 'bigint',
	});

	return drizzle(client, { schema });
};
