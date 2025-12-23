import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/**
 * Cursor IDE SQLite Database Schema
 * Source: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
 *
 * Note: The database schema defines these columns as BLOB, but the actual data
 * is JSON text. Using text() here allows Drizzle to return the data as strings
 * which can be parsed as JSON.
 */

export const itemTable = sqliteTable(
	'ItemTable',
	{
		key: text(),
		value: text(),
	},
	(table) => [unique('ItemTable_key_unique').on(table.key)]
);

export const cursorDiskKv = sqliteTable(
	'cursorDiskKV',
	{
		key: text(),
		value: text(),
	},
	(table) => [unique('cursorDiskKV_key_unique').on(table.key)]
);
