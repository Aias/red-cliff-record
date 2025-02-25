import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { recordCreators, recordRelations, records } from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';

export const relationsRouter = createTRPCRouter({});
