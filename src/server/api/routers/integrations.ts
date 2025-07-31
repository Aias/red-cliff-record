import { TRPCError } from '@trpc/server';
import { syncLightroomImages } from '../../integrations/adobe/sync';
import { syncAirtableData } from '../../integrations/airtable/sync';
import { syncFeedbin } from '../../integrations/feedbin/sync';
import { syncGitHubData } from '../../integrations/github/sync';
import { syncRaindropData } from '../../integrations/raindrop/sync';
import { syncReadwiseDocuments } from '../../integrations/readwise/sync';
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
	runAirtable: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

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
			await syncAirtableData();

			messages.push({
				type: 'success',
				message: `Airtable sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
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
				message: `Airtable sync failed: ${errorMessage}`,
			});
		} finally {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),
	runAdobe: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

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
			await syncLightroomImages();

			messages.push({
				type: 'success',
				message: `Adobe sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
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
				message: `Adobe sync failed: ${errorMessage}`,
			});
		} finally {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),
	runReadwise: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

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
			await syncReadwiseDocuments();

			messages.push({
				type: 'success',
				message: `Readwise sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
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
				message: `Readwise sync failed: ${errorMessage}`,
			});
		} finally {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),
	runFeedbin: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

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
			await syncFeedbin();

			messages.push({
				type: 'success',
				message: `Feedbin sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
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
				message: `Feedbin sync failed: ${errorMessage}`,
			});
		} finally {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),
	runGithub: publicProcedure.mutation(async (): Promise<IntegrationResult> => {
		const messages: LogMessage[] = [];
		let entriesCreated = 0;

		const originalConsoleLog = console.log;
		const originalConsoleError = console.error;
		const originalConsoleWarn = console.warn;

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(' ');

			const entryMatch = message.match(/Successfully created (\d+) entries/);
			if (entryMatch && entryMatch[1]) {
				entriesCreated = parseInt(entryMatch[1], 10);
			}

			messages.push({
				type: 'info',
				message,
				timestamp: new Date(),
			});

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
			await syncGitHubData();

			messages.push({
				type: 'success',
				message: `GitHub sync completed successfully${entriesCreated > 0 ? `. Created ${entriesCreated} entries.` : '.'}`,
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
				message: `GitHub sync failed: ${errorMessage}`,
			});
		} finally {
			console.log = originalConsoleLog;
			console.error = originalConsoleError;
			console.warn = originalConsoleWarn;
		}
	}),
});
