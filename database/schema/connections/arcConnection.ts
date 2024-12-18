import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
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
	const sqlite = new Database(arcDbCopyPath, { readonly: true });
	return drizzle(sqlite, { schema });
};
