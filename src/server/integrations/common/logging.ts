/**
 * Creates a logger with a specific prefix for integration processes
 *
 * @param integration - The name of the integration (e.g., 'twitter', 'github')
 * @param process - The specific process being logged (e.g., 'sync', 'map')
 * @returns An object with logging methods
 */
export function createIntegrationLogger(integration: string, process: string) {
	const prefix = `[${integration}:${process}]`;

	return {
		/**
		 * Log an informational message
		 */
		info: (message: string, ...args: unknown[]) => {
			console.log(`${prefix} ${message}`, ...args);
		},

		/**
		 * Log a warning message
		 */
		warn: (message: string, ...args: unknown[]) => {
			console.warn(`${prefix} ${message}`, ...args);
		},

		/**
		 * Log an error message
		 */
		error: (message: string, error?: unknown, ...args: unknown[]) => {
			if (error instanceof Error) {
				console.error(`${prefix} ${message}:`, error.message, ...args);
				if (error.stack) {
					console.error(error.stack);
				}
			} else if (error !== undefined) {
				console.error(`${prefix} ${message}:`, error, ...args);
			} else {
				console.error(`${prefix} ${message}`, ...args);
			}
		},

		/**
		 * Log the start of a process
		 */
		start: (message: string = 'Starting') => {
			console.log(`${prefix} ${message}`);
		},

		/**
		 * Log the completion of a process
		 */
		complete: (message: string = 'Completed', count?: number) => {
			const countStr = count !== undefined ? ` (${count} items)` : '';
			console.log(`${prefix} ${message}${countStr}`);
		},

		/**
		 * Log a skipped process
		 */
		skip: (message: string = 'Skipped', reason?: string) => {
			const reasonStr = reason ? `: ${reason}` : '';
			console.log(`${prefix} ${message}${reasonStr}`);
		},
	};
}

type IntegrationLogger = ReturnType<typeof createIntegrationLogger>;

/**
 * Parses the CLI arguments for the shared --debug flag and logs the status.
 *
 * @param logger - Integration logger scoped to the CLI command.
 * @returns Whether debug mode is enabled.
 */

export function parseDebugFlag(logger: IntegrationLogger): boolean {
	const debugEnabled = process.argv.includes('--debug');
	if (debugEnabled) {
		logger.info('Debug mode enabled - raw data will be saved to .temp/');
	}
	return debugEnabled;
}
