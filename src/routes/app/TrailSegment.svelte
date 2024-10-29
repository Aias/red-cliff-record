<script lang="ts">
	import { setContext } from 'svelte';
	import EntityItem from './EntityItem.svelte';
	import ExtractItem from './ExtractItem.svelte';
	import { entityTypes } from '$helpers/params';
	import { capitalize } from '$helpers/grammar';
	import type { TrailSegment } from '$lib/trail.svelte';
	import {
		getCreatorWithExtracts,
		getSpaceWithExtracts,
		getExtractWithChildren
	} from '$lib/queries';
	import type {
		CreatorWithExtractsResult,
		SpaceWithExtractsResult,
		ExtractWithChildrenResult
	} from '$lib/queries';
	import { error } from '@sveltejs/kit';

	interface TrailSegmentProps {
		segment: TrailSegment;
	}
	let { segment }: TrailSegmentProps = $props();

	let { entityType, entityId } = $derived(segment);

	let creator = $state<CreatorWithExtractsResult>();
	let space = $state<SpaceWithExtractsResult>();
	let extract = $state<ExtractWithChildrenResult>();

	async function fetchCreator(creatorId: string) {
		creator = await getCreatorWithExtracts(creatorId);
	}
	async function fetchSpace(spaceId: string) {
		space = await getSpaceWithExtracts(spaceId);
	}
	async function fetchExtracts(extractId: string) {
		extract = await getExtractWithChildren(extractId);
	}

	$effect.pre(() => {
		setContext('trailSegment', segment);
	});

	$effect(() => {
		switch (entityType.key) {
			case entityTypes.extract.key:
				fetchExtracts(entityId);
				break;
			case entityTypes.creator.key:
				fetchCreator(entityId);
				break;
			case entityTypes.space.key:
				fetchSpace(entityId);
				break;
			default:
				error(500, 'Unknown entity type');
				break;
		}
	});
</script>

{#if creator}
	<EntityItem title={creator.name} extracts={creator.extracts} />
{:else if space}
	<EntityItem title={capitalize(space.title || space.topic)} extracts={space.extracts} />
{:else if extract}
	<ExtractItem {extract} />
{:else}
	<div class="loading-container">
		<p><em>Loading...</em></p>
		<div class="loader"></div>
	</div>
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
	}
	p {
		color: var(--accent);
	}
	/* https://css-loaders.com/progress/ */
	.loader {
		height: 0.25rem;
		width: 100%;
		border-radius: var(--border-radius-small);
		--c: no-repeat linear-gradient(var(--main) 0 0);
		background: var(--c), var(--c), var(--sink);
		background-size: 60% 100%;
		animation: l16 3s infinite;
	}
	@keyframes l16 {
		0% {
			background-position:
				-150% 0,
				-150% 0;
		}
		66% {
			background-position:
				250% 0,
				-150% 0;
		}
		100% {
			background-position:
				250% 0,
				250% 0;
		}
	}
</style>
