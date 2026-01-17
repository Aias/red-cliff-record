import { write } from 'bun';
import { createIntegrationLogger } from './logging';

const logger = createIntegrationLogger('debug-output', 'helper');

type DebugContext<T> = {
  data: T | undefined;
  flush(): Promise<void>;
};

/**
 * Ensures the .temp directory exists at the project root
 */
async function ensureTempDirectory(): Promise<string> {
  const cwd = process.env.PWD;
  const tempDir = `${cwd ?? '.'}/.temp`;
  try {
    // Create directory if it doesn't exist (Bun.write will create parent dirs automatically)
    await write(`${tempDir}/.gitkeep`, '');
    return tempDir;
  } catch (error) {
    logger.error('Failed to create .temp directory', error);
    throw new Error(
      `Failed to create .temp directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function hasDebugContent(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value !== 'object') {
    return true;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasDebugContent(item, seen));
  }

  return Object.values(value as Record<string, unknown>).some((item) =>
    hasDebugContent(item, seen)
  );
}

/**
 * Creates a debug context that collects data and guarantees a single flush
 *
 * @param integrationName - The name of the integration (e.g., 'readwise', 'github')
 * @param debugEnabled - Whether debug collection is enabled
 * @param initialValue - The initial value for the debug data collector
 */
export function createDebugContext<T>(
  integrationName: string,
  debugEnabled: boolean,
  initialValue: T
): DebugContext<T> {
  const data = debugEnabled ? initialValue : undefined;
  let flushed = false;

  return {
    data,
    async flush() {
      if (!debugEnabled || flushed || !hasDebugContent(data)) {
        return;
      }

      flushed = true;
      await writeDebugOutput(integrationName, data);
    },
  };
}

/**
 * Writes debug data to a timestamped JSON file
 *
 * @param integrationName - The name of the integration (e.g., 'readwise', 'github')
 * @param data - The data to write to the file
 * @returns The path to the written file
 */
export async function writeDebugOutput(integrationName: string, data: unknown): Promise<string> {
  try {
    const tempDir = await ensureTempDirectory();

    // Create timestamp in ISO format, replacing colons with dashes for filesystem compatibility
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `${integrationName}-debug-${timestamp}.json`;
    const filepath = `${tempDir}/${filename}`;

    // Write the data as formatted JSON using Bun's native file writer
    await write(filepath, JSON.stringify(data, null, 2));

    logger.info(`Debug data written to ${filepath}`);
    return filepath;
  } catch (error) {
    logger.error(`Failed to write debug output for ${integrationName}`, error);
    throw new Error(
      `Failed to write debug output: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
