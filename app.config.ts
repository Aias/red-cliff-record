import { defineConfig } from '@tanstack/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		compatibilityDate: '2024-11-30',
	},
	vite: {
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				'@/app': '/app',
				'@/db': '/db',
			},
		},
	},
});
