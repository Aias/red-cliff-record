import { copyFileSync } from 'fs';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';
import * as schema from '../schema/browser-history';

const diaHistoryPath = 'Library/Application Support/Dia/User Data/Default/History';

/**
 * Returns the default path to the Dia browser history file.
 */
export const getDiaHistoryPath = () => join(homedir(), diaHistoryPath);

/**
 * Creates a database connection from a Dia history file.
 */
export const createDiaConnection = (historyPath: string = getDiaHistoryPath()) => {
	if (!existsSync(historyPath)) {
		throw new BrowserNotInstalledError('Dia', historyPath);
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
export const connectionUrl = `file:${getDiaHistoryPath()}-copy`;
