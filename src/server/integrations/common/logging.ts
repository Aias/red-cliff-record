/**
 * Creates a logger with a specific prefix for integration processes
 *
 * @param integration - The name of the integration (e.g., 'twitter', 'github')
 * @param process - The specific process being logged (e.g., 'sync', 'map')
 * @returns An object with logging methods
 */
export function createIntegrationLogger(integration: string, process: string) {
	const prefix = `[${integration}:${process}]`;
	const useAnsi = shouldUseAnsi();

	const styledPrefix = style(prefix, { dim: true, useAnsi });

	type Level = 'info' | 'warn' | 'start' | 'complete' | 'skip';

	function log(level: Level, message: string, ...args: unknown[]) {
		const styledMessage = style(message, { ...styleForLevel(level), useAnsi });
		// Always log to stderr so CLI JSON output stays clean on stdout.
		console.error(`${styledPrefix} ${styledMessage}`, ...args);
	}

	function logError(message: string, error?: unknown, ...args: unknown[]) {
		const styledMessage = style(message, { ...styleForLevel('error'), useAnsi });

		if (error instanceof Error) {
			console.error(`${styledPrefix} ${styledMessage}:`, error.message, ...args);
			if (error.cause) {
				if (error.cause instanceof Error) {
					console.error(`${styledPrefix} ${styledMessage} cause:`, error.cause.message);
					if (error.cause.stack) {
						console.error(style(error.cause.stack, { dim: true, useAnsi }));
					}
				} else {
					console.error(`${styledPrefix} ${styledMessage} cause:`, error.cause);
				}
			}
			if (error.stack) {
				console.error(style(error.stack, { dim: true, useAnsi }));
			}
			return;
		}

		if (error !== undefined) {
			console.error(`${styledPrefix} ${styledMessage}:`, error, ...args);
			return;
		}

		console.error(`${styledPrefix} ${styledMessage}`, ...args);
	}

	return {
		/**
		 * Log an informational message
		 */
		info: (message: string, ...args: unknown[]) => {
			log('info', message, ...args);
		},

		/**
		 * Log a warning message
		 */
		warn: (message: string, ...args: unknown[]) => {
			log('warn', message, ...args);
		},

		/**
		 * Log an error message
		 */
		error: (message: string, error?: unknown, ...args: unknown[]) => {
			logError(message, error, ...args);
		},

		/**
		 * Log the start of a process
		 */
		start: (message: string = 'Starting') => {
			log('start', message);
		},

		/**
		 * Log the completion of a process
		 */
		complete: (message: string = 'Completed', count?: number) => {
			const countStr = count !== undefined ? ` (${count} items)` : '';
			log('complete', `${message}${countStr}`);
		},

		/**
		 * Log a skipped process
		 */
		skip: (message: string = 'Skipped', reason?: string) => {
			const reasonStr = reason ? `: ${reason}` : '';
			log('skip', `${message}${reasonStr}`);
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

type StyleConfig = {
	useAnsi: boolean;
	color?: 'red' | 'green' | 'yellow' | 'gray';
	bold?: boolean;
	dim?: boolean;
};

function shouldUseAnsi(): boolean {
	if (process.env.NO_COLOR !== undefined) return false;
	if (process.env.TERM === 'dumb') return false;
	return Boolean(process.stderr.isTTY);
}

function styleForLevel(
	level: 'info' | 'warn' | 'error' | 'start' | 'complete' | 'skip'
): Omit<StyleConfig, 'useAnsi'> {
	switch (level) {
		case 'start':
		case 'complete':
			return { color: 'green', bold: true };
		case 'warn':
			return { color: 'yellow', bold: true };
		case 'error':
			return { color: 'red', bold: true };
		case 'skip':
			return { color: 'gray', dim: true };
		case 'info':
		default:
			return {};
	}
}

function style(text: string, config: StyleConfig): string {
	if (!config.useAnsi) return text;

	const parts: string[] = [];
	if (config.bold) parts.push('\x1b[1m');
	if (config.dim) parts.push('\x1b[2m');
	switch (config.color) {
		case 'red':
			parts.push('\x1b[31m');
			break;
		case 'green':
			parts.push('\x1b[32m');
			break;
		case 'yellow':
			parts.push('\x1b[33m');
			break;
		case 'gray':
			parts.push('\x1b[90m');
			break;
		default:
			break;
	}

	if (parts.length === 0) return text;
	return `${parts.join('')}${text}\x1b[0m`;
}
