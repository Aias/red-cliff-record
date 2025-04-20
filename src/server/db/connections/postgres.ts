import { Pool } from '@neondatabase/serverless';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema, relations });

export type Db = typeof db;
