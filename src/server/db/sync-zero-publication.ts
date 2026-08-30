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
 *
 * Columns the schema declares but the database does not have yet are left out:
 * a publication can only name columns that exist, and this runs on both sides
 * of the migration step.
 */
async function publishedTables(): Promise<{ table: string; columns: string[] }[]> {
  const rows = await db.execute<{ table: string; column: string }>(sql`
    SELECT table_name AS "table", column_name AS "column"
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  const columnsInDatabase = new Map<string, Set<string>>();
  for (const { table, column } of rows) {
    const columns = columnsInDatabase.get(table) ?? new Set<string>();
    columns.add(column);
    columnsInDatabase.set(table, columns);
  }

  return Object.values(schema.tables)
    .map((table) => {
      const name = 'serverName' in table ? table.serverName : table.name;
      const present = columnsInDatabase.get(name) ?? new Set<string>();
      return {
        table: name,
        columns: Object.entries(table.columns)
          .map(([column, definition]) => definition.serverName ?? column)
          .filter((column) => present.has(column)),
      };
    })
    .filter(({ columns }) => columns.length > 0)
    .sort((a, b) => a.table.localeCompare(b.table));
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

/**
 * Point the publication at exactly the columns the Zero schema declares.
 *
 * A Postgres column list pins the published set: a column added to a synced
 * table afterwards is not replicated, and zero-cache rejects every client with
 * `SchemaVersionNotSupported` until the list is restated. Postgres also refuses
 * to drop a column a publication names, so this runs on both sides of the
 * migration step: before, to release columns a migration is about to drop, and
 * after, to publish the ones it added. It is declarative and idempotent.
 */
export async function syncZeroPublication(): Promise<boolean> {
  const desired = await publishedTables();
  if (desired.length === 0) {
    logger.skip('No synced tables exist yet; leaving the publication untouched');
    return false;
  }
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
