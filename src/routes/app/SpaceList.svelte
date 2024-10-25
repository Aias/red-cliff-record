<script lang="ts">
	import { entityTypes } from '$helpers/params';
	import LinkGroup from '$components/LinkGroup.svelte';
	import type { SpaceListResult } from '$lib/queries';

	interface SpaceListProps {
		spaces: SpaceListResult;
	}
	let { spaces }: SpaceListProps = $props();
</script>

<ul class="entity-list">
	{#each spaces as space (space.id)}
		{@const { id, topic, extracts } = space}
		{@const groupName = topic || 'Unknown'}
		<li>
			<LinkGroup
				groupType={entityTypes.space}
				groupId={id}
				{groupName}
				links={extracts.map((e) => ({
					id: e.id,
					name: e.title
				}))}
			/>
		</li>
	{/each}
</ul>
