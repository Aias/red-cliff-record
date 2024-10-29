<script lang="ts">
	import { getArticle, combineAsList } from '$helpers/grammar';
	import type { ExtractWithChildrenResult } from '$lib/queries';

	interface ExtractSEOProps {
		extract: NonNullable<ExtractWithChildrenResult>;
	}
	let { extract }: ExtractSEOProps = $props();

	let title = $derived(extract.title || 'Extract');
	let creators = $derived(extract.creators || extract.parent?.creators || []);

	let description = $derived.by(() => {
		const type = extract.format?.name || 'extract';
		const creatorNames = combineAsList(creators.map((c) => c.name));
		const parent = extract.parent?.title || '';
		return `${getArticle(type)} ${type.toLowerCase()} by ${creatorNames}${parent ? ` from ${parent}` : ''}.`;
	});

	let modified = $derived.by(() => {
		const lastUpdated = extract.updatedAt;
		const publishedOn = extract.publishedOn ?? lastUpdated;
		return new Date(Math.max(lastUpdated.getTime(), publishedOn.getTime())).toISOString();
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta property="og:title" content={title} />
	<meta name="description" content={description} />
	<meta property="og:description" content={description} />
	<meta property="og:site_name" content="barnsworthburning" />
	<meta property="og:url" content={`https://barnsworthburning.net/extracts/${extract.id}`} />
	<meta property="og:type" content="article" />
	{#each extract.creators || extract.parent?.creators || [] as creator}
		<meta name="author" content={creator.name} />
		<meta property="og:article:author" content={creator.name} />
	{/each}
	<meta property="og:article:published_time" content={extract.createdAt.toISOString()} />
	<meta property="og:article:modified_time" content={modified} />
	{#each extract.attachments || [] as attachment}
		<meta property="og:image" content={attachment.url} />
	{/each}
</svelte:head>
