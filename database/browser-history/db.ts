import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { arcDbPath, arcDbCopyPath } from './constants';
import { copyFileSync } from 'fs';

copyFileSync(arcDbPath, arcDbCopyPath);

const sqlite = new Database(arcDbCopyPath, { readonly: true });
export const arcDb = drizzle(sqlite);
