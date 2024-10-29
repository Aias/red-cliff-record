<script lang="ts">
	import Link from './Link.svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CreatorLinkResult } from '$lib/queries';

	interface CreatorListProps extends HTMLAttributes<HTMLSpanElement> {
		creators: CreatorLinkResult[];
	}

	let { creators, ...restProps }: CreatorListProps = $props();
</script>

<span {...restProps}>
	{#each creators as creator, i (creator.id)}{i > 0
			? i + 1 === creators.length
				? ' & '
				: ', '
			: ''}
		<Link toType="creator" toId={creator.id}>{creator.name}</Link>
	{/each}
</span>

<style>
	span {
		color: var(--secondary);
		font-family: var(--font-stack-mono);
	}
</style>
