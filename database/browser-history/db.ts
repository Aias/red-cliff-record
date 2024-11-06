import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { dbPath, dbCopyPath } from './constants';
import { copyFileSync } from 'fs';

copyFileSync(dbPath, dbCopyPath);

const sqlite = new Database(dbCopyPath, { readonly: true });
export const db = drizzle(sqlite);
