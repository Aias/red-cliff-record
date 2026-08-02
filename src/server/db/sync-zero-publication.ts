import { sql } from 'drizzle-orm';
import { schema } from '@/shared/zero/schema.gen';
import { createIntegrationLogger } from '../integrations/common/logging';
import { db } from './connections/postgres';

const logger = createIntegrationLogger('services', 'sync-zero-publication');

/** The publication zero-cache replicates from (`ZERO_APP_PUBLICATIONS`). */
const PUBLICATION = 'zero_data';

/**
 * The columns Zero syncs, in Postgres terms. `records` carries types Zero
 * cannot replicate (`text_embedding` is a vector, `text_search` a tsvector),
 * so the publication names its columns explicitly rather than publishing the
 * whole table.
 */
function publishedTables(): { table: string; columns: string[] }[] {
  return Object.values(schema.tables)
    .map((table) => ({
      table: 'serverName' in table ? table.serverName : table.name,
      columns: Object.entries(table.columns).map(([name, column]) => column.serverName ?? name),
    }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

/**
 * Point the publication at exactly the columns the Zero schema declares.
 *
 * A Postgres column list pins the published set: a column added to a synced
 * table afterwards is not replicated, and zero-cache rejects every client with
 * `SchemaVersionNotSupported` until the list is restated. Running this after
 * migrations keeps the two in step. It is declarative and idempotent, so it is
 * safe to run on every deploy.
 */
export async function syncZeroPublication(): Promise<boolean> {
  const desired = publishedTables();
  const tableList = desired
    .map(({ table, columns }) => `${quote(table)} (${columns.map(quote).join(', ')})`)
    .join(', ');

  const existing = await db.execute<{ pubname: string }>(
    sql`SELECT pubname FROM pg_publication WHERE pubname = ${PUBLICATION}`
  );

  if (existing.length === 0) {
    await db.execute(sql.raw(`CREATE PUBLICATION ${quote(PUBLICATION)} FOR TABLE ${tableList}`));
    logger.complete(`Created publication ${PUBLICATION}`);
    return true;
  }

  const published = await db.execute<{ tablename: string; attnames: string[] }>(
    sql`SELECT tablename, attnames FROM pg_publication_tables WHERE pubname = ${PUBLICATION}`
  );
  const current = new Map(published.map((row) => [row.tablename, row.attnames]));
  const inSync =
    current.size === desired.length &&
    desired.every(({ table, columns }) => {
      const attnames = current.get(table);
      return (
        attnames?.length === columns.length && columns.every((column) => attnames.includes(column))
      );
    });

  if (inSync) {
    logger.skip(`Publication ${PUBLICATION} already matches the Zero schema`);
    return false;
  }

  await db.execute(sql.raw(`ALTER PUBLICATION ${quote(PUBLICATION)} SET TABLE ${tableList}`));
  logger.complete(`Updated publication ${PUBLICATION} to match the Zero schema`);
  return true;
}

if (import.meta.main) {
  await syncZeroPublication();
  process.exit(0);
}
