import { diaSchema } from '@hozo';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { BrowserNotInstalledError } from '@/server/integrations/browser-history/types';

const diaHistoryPath = 'Library/Application Support/Dia/User Data/Default/History';

// Path to Dia's History database (Mac OS Only)
export const diaDbPath = `${process.env.HOME}/${diaHistoryPath}`;
export const diaDbCopyPath = `${process.env.HOME}/${diaHistoryPath}-copy`;
export const connectionUrl = `file:${diaDbCopyPath}`;

export const createDiaConnection = async () => {
  const sourceFile = Bun.file(diaDbPath);
  if (!(await sourceFile.exists())) {
    throw new BrowserNotInstalledError('Dia', diaDbPath);
  }
  // Copy file using Bun's file API
  await Bun.write(diaDbCopyPath, sourceFile);

  const client = createClient({
    url: connectionUrl,
    intMode: 'bigint',
  });
  const db = drizzle({ client, schema: diaSchema });

  return { db, client };
};
