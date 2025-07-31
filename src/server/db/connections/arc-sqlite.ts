import { copyFileSync } from 'fs';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';
import * as schema from '../schema/browser-history';

const arcHistoryPath = 'Library/Application Support/Arc/User Data/Default/History';

/**
 * Returns the default path to the Arc browser history file.
 */
export const getArcHistoryPath = () => join(homedir(), arcHistoryPath);

/**
 * Creates a database connection from a browser history file.
 * A temporary copy of the file is created to avoid locking issues.
 */
export const createArcConnection = (historyPath: string = getArcHistoryPath()) => {
	if (!existsSync(historyPath)) {
		throw new BrowserNotInstalledError('Arc', historyPath);
	}

	const copyPath = `${historyPath}-copy`;
	copyFileSync(historyPath, copyPath);

	const connectionUrl = `file:${copyPath}`;
	const client = createClient({
		url: connectionUrl,
		intMode: 'bigint',
	});

	return drizzle(client, { schema });
};

// Convenience export used by Drizzle config files
export const connectionUrl = `file:${getArcHistoryPath()}-copy`;
