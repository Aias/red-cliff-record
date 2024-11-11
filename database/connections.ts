import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { copyFileSync } from 'fs';
import { arcDbCopyPath, arcDbPath } from './constants';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case'
	});
};

// SQLite connection for Arc browser
export const createArcConnection = () => {
  copyFileSync(arcDbPath, arcDbCopyPath);
  const sqlite = new Database(arcDbCopyPath, { readonly: true });
  return drizzleSqlite(sqlite);
};