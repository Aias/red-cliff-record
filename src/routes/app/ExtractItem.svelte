<script lang="ts">
	import { setContext } from 'svelte';
	import Extract from '$components/Extract.svelte';
	import ExtractList from './ExtractList.svelte';
	import type { ExtractWithChildrenResult } from '$lib/queries';

	interface ExtractItemProps {
		extract: NonNullable<ExtractWithChildrenResult>;
	}
	let { extract }: ExtractItemProps = $props();

	let children = $derived(extract.children);
	let connections = $derived(extract.connectedTo.map((c) => c.to));

	$effect.pre(() => {
		setContext('extract', extract);
	});
</script>

<article>
	<Extract {extract} class="chromatic" variant="card" suppressBlockLink />

	{#if children.length > 0}
		{#each children as child (child.id)}
			<Extract extract={child} suppressBlockLink />
		{/each}
	{/if}

	{#if connections.length > 0}
		<div class="connections-separator" role="presentation">
			<hr />
			<small class="text-secondary text-mono">See ⮂ Also</small>
			<hr />
		</div>
		<ExtractList extracts={connections} />
	{/if}
</article>

<style>
	article {
		max-width: 600px;
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		gap: 2em;
	}

	.connections-separator {
		display: flex;
		align-items: center;
		gap: 1em;

		hr {
			flex: 1;
		}
	}

	.connections-separator ~ :global(*) {
		font-size: var(--font-size-small);
	}
</style>
