import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import { media, MediaInsertSchema, type MediaInsert } from '@/server/db/schema/media';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const mediaRouter = createTRPCRouter({});
