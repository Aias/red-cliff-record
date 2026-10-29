#!/usr/bin/env bun
/**
 * rcr - Red Cliff Record CLI. Run `rcr --help` for commands.
 */

// Auto-compiles every zod schema on first parse. The bunfig.toml preload only
// applies when CWD is the repo root; the linked `rcr` bin runs from anywhere.
import 'zod/compile';
import { existsSync, readFileSync, realpathSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from project root or ~/.secrets when CWD has no .env
// Bun automatically loads .env from CWD, so we only need fallback logic
function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match?.[1] && match[2] !== undefined) {
        const cleanKey = match[1].trim();
        let cleanValue = match[2].trim();

        // Remove surrounding quotes if present
        if (
          (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
          (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
        ) {
          cleanValue = cleanValue.slice(1, -1);
        }

        // Only set if not already defined (Bun may have loaded from CWD)
        if (!process.env[cleanKey]) {
          process.env[cleanKey] = cleanValue;
        }
      }
    }
  } catch {
    // Silently fail if file can't be read
  }
}

// Only load manually if CWD has no .env (Bun handles CWD automatically)
const cwdEnv = resolve(process.cwd(), '.env');
if (!existsSync(cwdEnv)) {
  // Try to find project root by resolving symlink
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const realScriptPath = realpathSync(scriptPath);
    // Navigate from src/server/cli/rcr/index.ts to project root
    const projectRoot = resolve(dirname(realScriptPath), '../../../..');
    const projectEnv = join(projectRoot, '.env');

    if (existsSync(projectEnv)) {
      loadEnvFile(projectEnv);
    } else {
      // Fallback to ~/.secrets
      const homeSecrets = join(process.env.HOME || '~', '.secrets');
      if (existsSync(homeSecrets)) {
        loadEnvFile(homeSecrets);
      }
    }
  } catch {
    // If symlink resolution fails, try ~/.secrets
    const homeSecrets = join(process.env.HOME || '~', '.secrets');
    if (existsSync(homeSecrets)) {
      loadEnvFile(homeSecrets);
    }
  }
}

// Set NODE_ENV=development when --dev flag is present (must happen before DB imports)
if (process.argv.includes('--dev')) {
  process.env.NODE_ENV = 'development';
}

await import('./rcr');
