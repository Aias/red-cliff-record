<script lang="ts">
	import { setContext } from 'svelte';
	import EntityItem from './EntityItem.svelte';
	import ExtractItem from './ExtractItem.svelte';
	import { capitalize } from '$helpers/grammar';
	import type { TrailSegment } from '$lib/trail.svelte';
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

	const reviveDates = (obj: any): any => {
		if (obj && typeof obj === 'object') {
			if (obj.__isDate) {
				return new Date(obj.value);
			}
			for (const key in obj) {
				obj[key] = reviveDates(obj[key]);
			}
		}
		return obj;
	};

	async function fetchEntity() {
		try {
			const response = await fetch(`/${entityType.urlParam}/${entityId}`);
			if (!response.ok) error(500, 'Failed to fetch entity');

			const data = reviveDates(await response.json());
			if (data.creator) creator = data.creator;
			if (data.space) space = data.space;
			if (data.extract) extract = data.extract;
		} catch (err) {
			error(500, 'Failed to fetch entity');
		}
	}

	$effect.pre(() => {
		setContext('trailSegment', segment);
	});

	$effect(() => {
		fetchEntity();
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
