<script lang="ts">
	import { entityTypes } from '$helpers/params';
	import LinkGroup from '$components/LinkGroup.svelte';
	import type { CreatorListResult } from '$lib/queries';

	interface CreatorListProps {
		creators: CreatorListResult;
	}
	let { creators }: CreatorListProps = $props();
</script>

<ul class="entity-list">
	{#each creators as entity (entity.id)}
		<li>
			<LinkGroup
				groupType={entityTypes.creator}
				groupId={entity.id}
				groupName={entity.name || 'Unknown'}
				links={entity.extracts.map((e) => ({
					id: e.id,
					name: e.title
				}))}
			/>
		</li>
	{/each}
</ul>
