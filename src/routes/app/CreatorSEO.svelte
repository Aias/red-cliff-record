<script lang="ts">
	import { findFirstImageUrl } from '$helpers/images';
	import type { CreatorWithExtractsResult } from '$lib/queries';

	interface CreatorSEOProps {
		creator: NonNullable<CreatorWithExtractsResult>;
	}
	let { creator }: CreatorSEOProps = $props();

	let creatorName = $derived(creator.name || 'Anonymous');
	let description = $derived(`Curated works by ${creatorName}.`);

	let firstImageUrl = $derived(findFirstImageUrl(creator.extracts));
</script>

<svelte:head>
	<title>{creatorName}</title>
	<meta property="og:title" content={creatorName} />
	<meta name="description" content={description} />
	<meta property="og:description" content={description} />
	<meta property="og:site_name" content="barnsworthburning" />
	<meta property="og:url" content={`https://barnsworthburning.net/creators/${creator.id}`} />
	<meta property="og:type" content="article" />
	<meta property="og:article:author" content={creatorName} />
	<meta property="og:article:published_time" content={new Date(creator.createdAt).toISOString()} />
	<meta property="og:article:modified_time" content={new Date(creator.updatedAt).toISOString()} />
	{#if firstImageUrl}
		<meta property="og:image" content={firstImageUrl} />
	{/if}
</svelte:head>
