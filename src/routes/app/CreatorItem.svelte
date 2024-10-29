<script lang="ts">
	import EntityLayout from './EntityLayout.svelte';
	import type { CreatorWithExtractsResult } from '$lib/queries';

	interface CreatorItemProps {
		creator: NonNullable<CreatorWithExtractsResult>;
	}
	let { creator }: CreatorItemProps = $props();

	let creatorName = $derived(creator.name || 'Anonymous');
</script>

<EntityLayout title={creatorName} extracts={creator.extracts} />
