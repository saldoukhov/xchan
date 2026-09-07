<script lang="ts">
	let {
		title,
		names = [],
		lifeHash,
		words,
		variant = 'full'
	}: {
		title: string;
		names?: string[];
		lifeHash: string;
		words: string;
		variant?: 'full' | 'row';
	} = $props();

	const list = $derived(words.trim().split(/\s+/).filter(Boolean));
	const shownNames = $derived(names.map((name) => name.trim()).filter(Boolean));
	const fingerprint = $derived(list.slice(0, 3).join(' '));
	const primaryName = $derived(shownNames[0] ?? '');
</script>

{#if variant === 'row'}
	<div class="row-card">
		<img class="thumb" src={lifeHash} width="52" height="52" alt="" />
		<div class="meta">
			<span class="label">{title}</span>
			{#if primaryName}
				<span class="name">{primaryName}</span>
			{/if}
			<span class="fp">{fingerprint}</span>
		</div>
	</div>
{:else}
	<div class="card">
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
		<div class="body">
			<img class="lifehash" src={lifeHash} width="64" height="64" alt="" />
			<ol class="grid">
				{#each list as word, i (i)}
					<li><span class="n">{i + 1}</span> {word}</li>
				{/each}
			</ol>
		</div>
	</div>
{/if}

<style>
	.row-card {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
		padding: 18px 22px;
	}

	.thumb,
	.lifehash {
		display: block;
		border-radius: var(--radius-inset);
		image-rendering: pixelated;
		background: var(--inset);
		flex: none;
	}

	.thumb {
		width: 52px;
		height: 52px;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
	}

	.name {
		font-size: 16px;
		font-weight: 500;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fp {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink2);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 18px 18px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--card);
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-width: 0;
	}

	.names {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 4px 12px;
		min-width: 0;
		text-align: right;
		overflow: hidden;
	}

	.body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px 16px;
		min-width: 0;
	}

	.lifehash {
		width: 64px;
		height: 64px;
		flex: none;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, max-content);
		column-gap: 12px;
		row-gap: 2px;
		justify-content: start;
		flex: 1 1 240px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.45;
		color: var(--ink);
	}

	.grid li {
		white-space: nowrap;
	}

	.n {
		color: var(--ink3);
		font-size: 10px;
	}

	@media (max-width: 720px) {
		.row-card {
			padding: 14px 16px;
			gap: 12px;
		}

		.thumb {
			width: 44px;
			height: 44px;
		}

		.name {
			font-size: 15px;
		}

		.fp {
			font-size: 12px;
		}

		.grid {
			font-size: 11px;
			column-gap: 10px;
		}
	}
</style>
