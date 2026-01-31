import { BrowserSchema } from '@hozo';
import { createArcConnection } from '@/server/db/connections/arc-sqlite';
import type { BrowserConfig } from '../types';

export const arcConfig: BrowserConfig = {
  name: BrowserSchema.enum.arc,
  displayName: 'Arc',
  createConnection: createArcConnection,
};
