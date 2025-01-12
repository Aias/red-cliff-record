import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from '@tanstack/start/config';
import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	tsr: {
		appDirectory: './src/app',
	},
	vite: {
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
				// apply: 'build',
			},
			tailwindcss(),
		],
	},
});
