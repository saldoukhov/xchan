<script lang="ts">
	import { rich } from '$lib/i18n';

	let { text }: { text: string } = $props();
	const parts = $derived(rich(text));
</script>

{#each parts as part, i (`${i}-${part.text}`)}
	{#if part.strong}<strong>{part.text}</strong>{:else}{part.text}{/if}
{/each}
