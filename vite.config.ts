import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { EnvSchema, PortSchema } from './src/shared/lib/env';

export default defineConfig(({ mode }) => {
	// Load all environment variables
	const env = loadEnv(mode, process.cwd(), '');

	// Parse and validate all env vars
	const parsedEnv = EnvSchema.safeParse({
		...env,
		NODE_ENV: mode,
	});

	// Create process.env object with all validated env vars
	const processEnv = parsedEnv.success ? parsedEnv.data : {};

	return {
		server: {
			port: PortSchema.parse(env.PUBLIC_DEV_PORT),
		},
		envPrefix: ['PUBLIC_', 'VITE_'],
		define: {
			// Not good if you plan on deploying to a cloud environment rather than a local network.
			'process.env': JSON.stringify(processEnv),
		},
		plugins: [
			tsConfigPaths(),
			tanstackStart({
				target: 'bun',
				customViteReactPlugin: true,
				tsr: {
					srcDirectory: './src/app',
				},
			}),
			viteReact({
				babel: {
					plugins: [['babel-plugin-react-compiler', { target: '19' }]],
				},
			}),
			tailwindcss(),
		],
	};
});
