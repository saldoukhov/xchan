<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '$lib/Icon.svelte';
	import RichText from '$lib/RichText.svelte';
	import { fill, formatReleaseDate, i18n } from '$lib/i18n.svelte';
	import { APP_VERSION, RELEASES, parseWhatsNew, type Release } from '$lib/releases';

	const m = $derived(i18n.m);

	let releases = $state<Release[]>(RELEASES);
	let hostVersion = $state(APP_VERSION);

	onMount(() => {
		void loadHostNotes();
	});

	async function loadHostNotes() {
		try {
			const response = await fetch('/whats-new.json', { cache: 'no-store' });
			if (!response.ok) return;
			const parsed = parseWhatsNew(await response.json());
			if (!parsed) return;
			hostVersion = parsed.version;
			releases = parsed.releases;
		} catch {
			// Bundled notes stay on screen if the host cannot be reached.
		}
	}
</script>

<svelte:head>
	<title>{m.meta.whatsNewTitle}</title>
	<meta name="description" content={m.meta.whatsNewDescription} />
</svelte:head>

<main>
	<header class="top">
		<a class="icon outlined" href={resolve('/')} aria-label={m.common.backHome}>
			<Icon name="back" size={20} />
		</a>
		<div class="intro">
			<h1>{m.whatsNew.title}</h1>
			<p class="lede">
				<RichText text={fill(m.whatsNew.lede, { version: APP_VERSION })} />
			</p>
			{#if hostVersion !== APP_VERSION}
				<p class="lede">
					<RichText text={fill(m.whatsNew.hostVersion, { version: hostVersion })} />
				</p>
			{/if}
		</div>
	</header>

	{#each releases as release (release.version)}
		<section>
			<div class="release-head">
				<h2>{release.version}</h2>
				{#if release.version === APP_VERSION}
					<span class="badge">{m.whatsNew.onThisDevice}</span>
				{:else if release.version === hostVersion}
					<span class="badge incoming">{m.whatsNew.onTheServer}</span>
				{/if}
			</div>
			<p class="date">{formatReleaseDate(release.date, i18n.locale)}</p>
			<ul>
				{#each release.notes as note, i (`${release.version}-${i}`)}
					<li>{note}</li>
				{/each}
			</ul>
		</section>
	{/each}

	<p class="foot">
		<a href={resolve('/')}>{m.common.backToPairing}</a>
		<span aria-hidden="true"> · </span>
		<a href={resolve('/how')}>{m.common.howItWorks}</a>
	</p>
</main>

<style>
	.top {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.intro {
		min-width: 0;
		flex: 1;
	}

	.lede {
		max-width: 42em;
	}

	.lede + .lede {
		margin-top: 10px;
	}

	.lede :global(strong) {
		color: var(--ink);
		font-weight: 600;
	}

	h2 {
		margin: 0;
		font-size: 18px;
		text-transform: none;
		letter-spacing: -0.02em;
		color: var(--ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.release-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		margin-bottom: 6px;
	}

	.badge {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		padding: 3px 8px;
	}

	.badge.incoming {
		color: var(--accent);
		border-color: var(--accent);
	}

	.date {
		margin: 0 0 12px;
		color: var(--ink3);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	ul {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		list-style: none;
	}

	li {
		padding-left: 16px;
		position: relative;
		margin: 0;
		color: var(--ink2);
		font-size: 16px;
		line-height: 24px;
	}

	li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 10px;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--ink3);
	}

	@media (max-width: 720px) {
		.top {
			gap: 12px;
		}

		li {
			font-size: 15px;
			line-height: 22px;
		}
	}
</style>
