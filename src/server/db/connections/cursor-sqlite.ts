import { copyFileSync, existsSync } from 'fs';
import { cursorSchema } from '@aias/hozo';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const CURSOR_GLOBAL_STORAGE_PATH = `${Bun.env.HOME}/Library/Application Support/Cursor/User/globalStorage`;

// Path to Cursor's global storage database (macOS only)
export const cursorDbPath = `${CURSOR_GLOBAL_STORAGE_PATH}/state.vscdb`;
export const cursorDbCopyPath = `${CURSOR_GLOBAL_STORAGE_PATH}/state-copy.vscdb`;
export const connectionUrl = `file:${cursorDbCopyPath}`; // For drizzle-kit

export class CursorNotInstalledError extends Error {
	constructor() {
		super(`Cursor IDE database not found at: ${cursorDbPath}`);
		this.name = 'CursorNotInstalledError';
	}
}

export const createCursorConnection = () => {
	if (!existsSync(cursorDbPath)) {
		throw new CursorNotInstalledError();
	}
	copyFileSync(cursorDbPath, cursorDbCopyPath);

	const client = new Database(cursorDbCopyPath, { readonly: true });
	const db = drizzle({ client, schema: cursorSchema });

	return { db, client };
};
