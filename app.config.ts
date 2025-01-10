import { defineConfig } from '@tanstack/start/config';
// import react from '@vitejs/plugin-react';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
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
		],
	},
});
