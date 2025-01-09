import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from '@tanstack/start/config';
// import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	server: {
		compatibilityDate: '2024-11-30',
	},
	vite: {
		plugins: [
			tsConfigPaths(),
			// {
			// 	...react({
			// 		babel: {
			// 			plugins: [['babel-plugin-react-compiler', { target: '19' }]],
			// 		},
			// 	}),
			// 	apply: 'build',
			// },
			tailwindcss(),
		],
	},
});
