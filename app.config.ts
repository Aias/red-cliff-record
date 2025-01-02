import { defineConfig } from '@tanstack/start/config';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
	server: {
		compatibilityDate: '2024-11-30',
	},
	vite: {
		css: {
			postcss: {
				plugins: [tailwindcss, autoprefixer],
			},
		},
		resolve: {
			alias: {
				'@/app': '/app',
				'@/db': '/db',
			},
		},
	},
});
