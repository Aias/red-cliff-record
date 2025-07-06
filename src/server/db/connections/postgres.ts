import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sql';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';

export const db = drizzle(process.env.DATABASE_URL!, { schema, relations });

export type Db = typeof db;
