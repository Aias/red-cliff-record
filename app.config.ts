import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from '@tanstack/react-start/config';
import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	server: {
		experimental: {
			asyncContext: true,
		},
	},
	tsr: {
		appDirectory: './src/app',
		apiBase: '/trpc',
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
			},
			tailwindcss(),
		],
	},
});
