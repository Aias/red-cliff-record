import { copyFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../schema/arc';

const arcHistoryPath = 'Library/Application Support/Arc/User Data/Default/History';

// Path to Arc's History database (Mac OS Only)
export const arcDbPath = join(homedir(), arcHistoryPath);
export const arcDbCopyPath = join(homedir(), `${arcHistoryPath}-copy`);
export const connectionUrl = `file:${arcDbCopyPath}`;

export const createArcConnection = () => {
	copyFileSync(arcDbPath, arcDbCopyPath);

	const client = createClient({
		url: connectionUrl,
		intMode: 'bigint',
	});

	return drizzle(client, { schema });
};
