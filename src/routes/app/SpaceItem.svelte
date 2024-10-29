<script lang="ts">
	import EntityLayout from './EntityLayout.svelte';
	import { capitalize } from '$helpers/grammar';
	import type { SpaceWithExtractsResult } from '$lib/queries';

	interface SpaceItemProps {
		space: NonNullable<SpaceWithExtractsResult>;
	}
	let { space }: SpaceItemProps = $props();

	let title = $derived(capitalize(space.title || space.topic || 'Untagged'));
</script>

<EntityLayout {title} extracts={space.extracts} />
