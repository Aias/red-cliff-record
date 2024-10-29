<script lang="ts">
	import CreatorItem from '../../app/CreatorItem.svelte';
	import CreatorSEO from '../../app/CreatorSEO.svelte';
	import SpaceItem from '../../app/SpaceItem.svelte';
	import SpaceSEO from '../../app/SpaceSEO.svelte';
	import ExtractItem from '../../app/ExtractItem.svelte';
	import ExtractSEO from '../../app/ExtractSEO.svelte';

	let { data } = $props();

	let { creator, space, extract } = $derived(data);
</script>

{#if creator}
	<CreatorItem {creator} />
	<CreatorSEO {creator} />
{:else if space}
	<SpaceItem {space} />
	<SpaceSEO {space} />
{:else if extract}
	<ExtractItem {extract} />
	<ExtractSEO {extract} />
{/if}
