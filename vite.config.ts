import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	server: {
		port: 3000,
	},
	plugins: [
		tsConfigPaths({
			projects: ['./tsconfig.json'],
		}),
		{
			...viteReact({
				babel: {
					plugins: [['babel-plugin-react-compiler', { target: '19' }]],
				},
			}),
		},
		tanstackStart({
			// customViteReactPlugin: true, TODO: Revisit this, causing errors with process.env
			tsr: {
				srcDirectory: './src/app',
			},
		}),
		tailwindcss(),
	],
});
