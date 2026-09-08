<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/theme.svelte';
	import { applyWaitingUpdate, dismissUpdate, initUpdates, updateState } from '$lib/update.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		void initUpdates();
	});
</script>

{#if updateState.updateAvailable}
	<div class="update-banner" role="status">
		<div class="update-inner">
			<p>A new version is on the server. This device will keep the current app until you update.</p>
			<div class="row">
				<button type="button" class="ghost" onclick={dismissUpdate}>Later</button>
				<button type="button" onclick={applyWaitingUpdate}>Update</button>
			</div>
		</div>
	</div>
{/if}

{@render children()}

<style>
	.update-banner {
		position: sticky;
		top: 0;
		z-index: 40;
		border-bottom: 1px solid var(--line);
		background: var(--menu);
	}

	.update-inner {
		max-width: 920px;
		margin: 0 auto;
		padding: max(12px, env(safe-area-inset-top)) max(40px, env(safe-area-inset-right)) 12px
			max(40px, env(safe-area-inset-left));
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 16px;
		box-sizing: border-box;
	}

	.update-inner p {
		margin: 0;
		flex: 1 1 16rem;
		color: var(--ink2);
		font-size: 15px;
		line-height: 22px;
	}

	.update-inner .row {
		flex: none;
	}

	.update-inner button {
		height: 36px;
		padding: 0 16px;
		font-size: 14px;
	}

	@media (max-width: 720px) {
		.update-inner {
			padding: max(12px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) 12px
				max(20px, env(safe-area-inset-left));
		}
	}
</style>
