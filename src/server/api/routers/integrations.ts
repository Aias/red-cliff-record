import { promises as fs } from 'fs';
import os from 'os';
import { join } from 'path';
import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';
import { arcConfig } from '../../integrations/browser-history/browsers/arc';
import { diaConfig } from '../../integrations/browser-history/browsers/dia';
import { createBrowserSyncFunction } from '../../integrations/browser-history/sync';
import { syncRaindropData } from '../../integrations/raindrop/sync';
import { syncTwitterData } from '../../integrations/twitter/sync';
import { createTRPCRouter, publicProcedure } from '../init';

interface LogMessage {
	type: 'info' | 'error' | 'warn' | 'success';
	message: string;
	timestamp: Date;
}

interface IntegrationResult {
	success: boolean;
	messages: LogMessage[];
	entriesCreated?: number;
	error?: string;
}

const BrowserHistoryInputSchema = z.object({
	browser: z.enum(['arc', 'dia']),
	fileData: z.string().optional(),
	fileName: z.string().optional(),
});

const TwitterFileSchema = z.object({
	fileName: z.string(),
	fileData: z.string(),
});

const TwitterSyncInputSchema = z.object({
	files: z.array(TwitterFileSchema).optional(),
});

export const integrationsRouter = createTRPCRouter({
	runRaindrop: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		// Capture console.log messages
		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			// Parse for entry count from the standard message format
			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

			// Still log to actual console for debugging
			originalConsoleLog(...args);
		};

		console.error = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			messages.push({
				type: 'error',
				message,
				timestamp: new Date(),
			});

			originalConsoleError(...args);
		};

		console.warn = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			messages.push({
				type: 'warn',
				message,
				timestamp: new Date(),
			});

			originalConsoleWarn(...args);
		};

		try {
			// Run the sync
			await syncRaindropData();

			// Mark completion
			messages.push({
				type: 'success',
				message: `Raindrop sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
				timestamp: new Date(),
			});

			return {
				success: true,
				messages,
				entriesCreated,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			messages.push({
				type: 'error',
				message: `Sync failed: ${errorMessage}`,
				timestamp: new Date(),
			});

			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Raindrop sync failed: ${errorMessage}`,
			});
		} finally {
			// Restore console methods
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),

	runBrowserHistory: publicProcedure
		.input(BrowserHistoryInputSchema)
		.mutation(async ({ input }): Promise<IntegrationResult> => {
			const messages: LogMessage[] = [];
			const originalConsoleLog = console.log;
			const originalConsoleError = console.error;
			const originalConsoleWarn = console.warn;

			console.log = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'info', message, timestamp: new Date() });
				originalConsoleLog(...args);
			};

			console.error = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'error', message, timestamp: new Date() });
				originalConsoleError(...args);
			};

			console.warn = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'warn', message, timestamp: new Date() });
				originalConsoleWarn(...args);
			};

			const config = input.browser === 'arc' ? arcConfig : diaConfig;
			const sync = createBrowserSyncFunction(config);

			let tempDir: string | null = null;
			try {
				let filePath: string | undefined;
				if (input.fileData && input.fileName) {
					tempDir = await fs.mkdtemp(join(os.tmpdir(), 'browser-'));
					filePath = join(tempDir, input.fileName);
					await fs.writeFile(filePath, Buffer.from(input.fileData, 'base64'));
				}

				await sync(filePath);

				messages.push({
					type: 'success',
					message: `${config.displayName} sync completed`,
					timestamp: new Date(),
				});

				return { success: true, messages };
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				messages.push({
					type: 'error',
					message: `Sync failed: ${errorMessage}`,
					timestamp: new Date(),
				});
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Browser history sync failed: ${errorMessage}`,
				});
			} finally {
				console.log = originalConsoleLog;
				console.error = originalConsoleError;
				console.warn = originalConsoleWarn;
				if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
			}
		}),

	runTwitter: publicProcedure
		.input(TwitterSyncInputSchema)
		.mutation(async ({ input }): Promise<IntegrationResult> => {
			const messages: LogMessage[] = [];
			const originalConsoleLog = console.log;
			const originalConsoleError = console.error;
			const originalConsoleWarn = console.warn;

			console.log = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'info', message, timestamp: new Date() });
				originalConsoleLog(...args);
			};

			console.error = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'error', message, timestamp: new Date() });
				originalConsoleError(...args);
			};

			console.warn = (...args: unknown[]) => {
				const message = args
					.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
					.join(' ');
				messages.push({ type: 'warn', message, timestamp: new Date() });
				originalConsoleWarn(...args);
			};

			let tempDir: string | null = null;
			try {
				let dataDir: string | undefined;
				if (input.files && input.files.length > 0) {
					tempDir = await fs.mkdtemp(join(os.tmpdir(), 'twitter-'));
					for (const f of input.files) {
						const p = join(tempDir, f.fileName);
						await fs.writeFile(p, Buffer.from(f.fileData, 'base64'));
					}
					dataDir = tempDir;
				}

				await syncTwitterData(dataDir);

				messages.push({
					type: 'success',
					message: 'Twitter sync completed',
					timestamp: new Date(),
				});

				return { success: true, messages };
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				messages.push({
					type: 'error',
					message: `Sync failed: ${errorMessage}`,
					timestamp: new Date(),
				});
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Twitter sync failed: ${errorMessage}`,
				});
			} finally {
				console.log = originalConsoleLog;
				console.error = originalConsoleError;
				console.warn = originalConsoleWarn;
				if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
			}
		}),
});
