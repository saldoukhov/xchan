<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLocale } from '$lib/i18n.svelte';
	import { initTheme } from '$lib/theme.svelte';
	import { initUpdates } from '$lib/update.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initLocale();
		void initUpdates();
	});
</script>

{@render children()}
