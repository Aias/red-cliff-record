<script lang="ts">
	import type { Attachment } from '@prisma/client';

	interface ImageProps {
		image: Attachment;
	}

	let { image }: ImageProps = $props();
</script>

<div class="image-container">
	<img alt={image.altText ?? image.caption ?? image.url} src={image.url} loading="lazy" />
</div>

<style>
	.image-container {
		inline-size: 100%;
		aspect-ratio: var(--aspect-ratio, 'auto');
		border: 1px solid var(--splash);
		overflow: hidden;

		img {
			inline-size: 100%;
			height: auto;
		}
	}
</style>
