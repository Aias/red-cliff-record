<script lang="ts">
	import ExtractGallery from '$components/ExtractGallery.svelte';
	import type { ExtractSearchResult } from '$lib/queries';

	interface EntityLayoutProps {
		title: string;
		extracts?: ExtractSearchResult[];
	}
	let { title, extracts }: EntityLayoutProps = $props();
</script>

<h1>{title}</h1>
{#if extracts}
	<ExtractGallery {extracts} />
{:else}
	<em>No associated extracts.</em>
{/if}

<style>
	h1 {
		margin-block-end: 0.5em;
	}
</style>
