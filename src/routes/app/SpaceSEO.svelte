<script lang="ts">
	import { capitalize } from '$helpers/grammar';
	import { findFirstImageUrl } from '$helpers/images';
	import type { SpaceWithExtractsResult } from '$lib/queries';

	interface SpaceSEOProps {
		space: NonNullable<SpaceWithExtractsResult>;
	}
	let { space }: SpaceSEOProps = $props();

	let title = $derived(capitalize(space.title || space.topic || 'Untagged'));
	let description = $derived(`Curated extracts about ${title}.`);

	let firstImageUrl = $derived(findFirstImageUrl(space.extracts));
</script>

<svelte:head>
	<title>{title}</title>
	<meta property="og:title" content={title} />
	<meta name="description" content={description} />
	<meta property="og:description" content={description} />
	<meta property="og:site_name" content="barnsworthburning" />
	<meta property="og:url" content={`https://barnsworthburning.net/spaces/${space.id}`} />
	<meta property="og:type" content="article" />
	<meta property="article:section" content={title} />
	<meta property="article:tag" content={space.topic} />
	<meta property="og:article:published_time" content={space.createdAt.toISOString()} />
	<meta property="og:article:modified_time" content={space.updatedAt.toISOString()} />
	{#if firstImageUrl}
		<meta property="og:image" content={firstImageUrl} />
	{/if}
</svelte:head>
