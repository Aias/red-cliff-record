import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$components: 'src/components',
			$lib: 'src/lib',
			$server: 'src/lib/server',
			$styles: 'src/styles',
			$types: 'src/types'
		}
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
