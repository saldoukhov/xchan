<script lang="ts">
	let {
		title,
		names = [],
		lifeHash,
		words,
		compact = false
	}: {
		title: string;
		names?: string[];
		lifeHash: string;
		words: string;
		compact?: boolean;
	} = $props();

	const list = $derived(words.trim().split(/\s+/).filter(Boolean));
	const shownNames = $derived(names.map((name) => name.trim()).filter(Boolean));
</script>

<div class="card" class:compact>
	<div class="head">
		<span class="label">{title}</span>
		{#if shownNames.length > 0}
			<div class="names">
				{#each shownNames as name (name)}
					<span class="name">{name}</span>
				{/each}
			</div>
		{/if}
	</div>
	<div class="hash-wrap">
		<img class="lifehash" src={lifeHash} width="64" height="64" alt="" />
	</div>
	<ol class="grid">
		{#each list as word, i (i)}
			<li><span class="n">{i + 1}</span> {word}</li>
		{/each}
	</ol>
</div>

<style>
	.card {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto 1fr;
		gap: 0.55rem 0.85rem;
		align-items: stretch;
		padding: 0.85rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface-2);
	}

	.head {
		grid-column: 1 / -1;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		min-width: 0;
	}

	.names {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.15rem 0.7rem;
		min-width: 0;
		text-align: right;
	}

	.name {
		font-size: 0.92rem;
		font-weight: 650;
		letter-spacing: -0.02em;
	}

	.hash-wrap {
		align-self: stretch;
		aspect-ratio: 1;
		min-height: 5.5rem;
		height: 100%;
	}

	.lifehash {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
		border-radius: 8px;
		background: #0b0e0a;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, max-content);
		column-gap: 0.7rem;
		row-gap: 0.12rem;
		justify-content: center;
		justify-self: center;
		align-self: center;
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		line-height: 1.35;
	}

	.n {
		color: var(--faint);
		font-size: 0.62rem;
	}

	.compact {
		padding: 0.65rem 0.75rem;
	}

	.compact .hash-wrap {
		min-height: 0;
	}

	.compact .grid {
		font-size: 0.64rem;
	}
</style>
