import { arcSchema } from '@hozo';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';

const arcHistoryPath = 'Library/Application Support/Arc/User Data/Default/History';

// Path to Arc's History database (Mac OS Only)
export const arcDbPath = `${process.env.HOME}/${arcHistoryPath}`;
export const arcDbCopyPath = `${process.env.HOME}/${arcHistoryPath}-copy`;
export const connectionUrl = `file:${arcDbCopyPath}`;

export const createArcConnection = async () => {
  const sourceFile = Bun.file(arcDbPath);
  if (!(await sourceFile.exists())) {
    throw new BrowserNotInstalledError('Arc', arcDbPath);
  }
  // Copy file using Bun's file API
  await Bun.write(arcDbCopyPath, sourceFile);

  const client = createClient({
    url: connectionUrl,
    intMode: 'bigint',
  });
  const db = drizzle({ client, schema: arcSchema });

  return { db, client };
};
