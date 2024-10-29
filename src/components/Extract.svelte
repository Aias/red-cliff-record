<script lang="ts">
	import markdown from '$helpers/markdown';
	import BlockLink from './BlockLink.svelte';
	import Citation from './Citation.svelte';
	import TopicList from './TopicList.svelte';
	import RelationList from './RelationList.svelte';
	import Image from './Image.svelte';
	import Link from './Link.svelte';
	import { AirtableBaseId, ExtractView, Table } from '$types/Airtable';
	import type { ExtractLinkResult, ExtractSearchResult } from '$lib/queries';
	import { classnames } from '$helpers/classnames';
	import type { HTMLAttributes } from 'svelte/elements';
	import CreatorList from './CreatorList.svelte';

	interface ExtractProps<T extends keyof HTMLElementTagNameMap>
		extends HTMLAttributes<HTMLElementTagNameMap[T]> {
		extract: ExtractSearchResult | ExtractLinkResult;
		element?: T;
		suppressBlockLink?: boolean;
		variant?: 'default' | 'card';
	}

	let {
		extract,
		element = 'article',
		suppressBlockLink = false,
		class: className,
		variant = 'default'
	}: ExtractProps<any> = $props();

	let id = $derived(extract.id);
	let title = $derived(extract.title);
	let extractContent = $derived(extract.content);
	let notes = $derived(extract.notes);
	let images = $derived(extract.attachments);
	let imageCaption = $derived(extract.attachments?.[0]?.caption);

	let parent = $derived(extract.parent);
	let children = $derived(extract.children.map(({ id, title }) => ({ id, name: title })));
	let connections = $derived(
		extract.connectedTo.map(({ to }) => ({
			id: to.id,
			name: to.title
		}))
	);
	let spaces = $derived(extract.spaces);

	let hasRelations = $derived(children.length > 0 || connections.length > 0 || spaces.length > 0);

	let airtableUrl = $derived(
		`https://airtable.com/${AirtableBaseId}/${Table.Extracts}/${ExtractView.EntryView}/${extract.id}`
	);
	const openInAirtable = (event: MouseEvent) => {
		event.preventDefault();
		window.open(airtableUrl, '_blank');
	};
</script>

<BlockLink
	{element}
	class={classnames('extract', `extract--${variant}`, 'ssm-container', className)}
	suppress={suppressBlockLink}
>
	{#if parent}
		<section class="extract-parent">
			<strong class="parent-title"><Link toId={parent.id} inherit>{parent.title}</Link></strong>
			{#if parent.creators.length > 0}
				<CreatorList class="parent-creators" creators={parent.creators} />
			{/if}
		</section>
	{/if}
	<section class="extract-body">
		{#if title}
			<header>
				<h2 class="extract-title">
					<Link toId={id} class="main-link" inherit>
						{title}
					</Link>
				</h2>
				<button
					class="ssm content-opener chromatic"
					onclick={openInAirtable}
					title="Open in Airtable">☁️</button
				>
			</header>
		{/if}
		<figure class="extract-main">
			{#if images.length > 0}
				{#each images as image (image.id)}
					<Image {image} />
				{/each}
				{#if imageCaption}
					<div class="extract-image-caption content">
						{@html markdown.parse(imageCaption)}
					</div>
				{/if}
			{/if}
			{#if extractContent}
				<blockquote class="extract-text content" cite={extract.sourceUrl}>
					{@html markdown.parse(extractContent)}
				</blockquote>
			{/if}
			<Citation {extract} element="figcaption" />
		</figure>
		{#if hasRelations}
			<nav class="relations">
				{#if children.length > 0}
					<RelationList items={children} symbol="↳" label="Children" />
				{/if}
				{#if connections.length > 0}
					<RelationList items={connections} symbol="⮂" label="Connections" />
				{/if}
				{#if spaces.length > 0}
					<TopicList topics={spaces} />
				{/if}
			</nav>
		{/if}
	</section>
	{#if notes}
		<footer class="extract-footer content">
			{@html markdown.parse(notes)}
		</footer>
	{/if}
</BlockLink>
