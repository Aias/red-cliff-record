import { config } from 'dotenv';
import { join, dirname } from 'path';
import { cwd } from 'process';
import { existsSync } from 'fs';

export function loadEnv() {
	// Get the root directory by going up until we find pnpm-workspace.yaml
	function findRootDir(currentDir: string): string {
		const workspaceFile = join(currentDir, 'pnpm-workspace.yaml');

		if (existsSync(workspaceFile)) {
			return currentDir;
		}

		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			throw new Error('Could not find workspace root (no pnpm-workspace.yaml found)');
		}

		return findRootDir(parentDir);
	}

	const rootDir = findRootDir(cwd());
	config({ path: join(rootDir, '.env') });
}
