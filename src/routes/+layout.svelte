<script lang="ts">
	import '$styles/app.css';
	import { Palette, Mode, Chroma } from '$types/Theme';
	import settings from '$lib/settings.svelte';
	import { getCookie } from '$lib/cookies';
	import SEO from '$components/SEO.svelte';

	let { children, data } = $props();

	$effect.pre(() => {
		const storedMode = getCookie('mode') as Mode | null;
		const storedChroma = getCookie('chroma') as Chroma | null;
		const storedPalette = getCookie('palette') as Palette | null;

		if (storedMode) {
			settings.setMode(storedMode);
		}
		if (storedChroma) {
			settings.setChroma(storedChroma);
		}
		if (storedPalette) {
			settings.setPalette(storedPalette);
		}

		document.documentElement.className = settings.themeClass;
	});
</script>

<SEO />
{@render children()}
