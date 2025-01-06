import { defineConfig } from '@tanstack/start/config';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		compatibilityDate: '2024-11-30',
	},
	vite: {
		plugins: [tsConfigPaths(), tailwindcss()],
	},
});
