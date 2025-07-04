import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
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
			...react({
				babel: {
					plugins: [['babel-plugin-react-compiler', { target: '19' }]],
				},
			}),
		},
		tailwindcss(),
		tanstackStart({
			target: 'cloudflare-pages',
			tsr: {
				srcDirectory: './src/app',
			},
		}),
	],
});
