<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/Icon.svelte';
	import RichText from '$lib/RichText.svelte';
	import { fill, i18n } from '$lib/i18n.svelte';
	import { PAIRING_SECONDS } from '$lib/pairing';

	const github = 'https://github.com/saldoukhov/xchan';
	const scorecard = 'https://scorecard.dev/viewer/?uri=github.com/saldoukhov/xchan';
	const m = $derived(i18n.m);

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(m.how.prompt);
			copied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
				copyTimer = null;
			}, 1500);
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>{m.meta.howTitle}</title>
	<meta name="description" content={m.meta.howDescription} />
</svelte:head>

<main>
	<header class="top">
		<a class="icon outlined" href={resolve('/')} aria-label={m.common.backHome}>
			<Icon name="back" size={20} />
		</a>
		<div class="intro">
			<h1>{m.how.title}</h1>
			<p class="lede">
				{m.how.lede1}
			</p>
			<p class="lede">
				{fill(m.how.lede2, { seconds: PAIRING_SECONDS })}
			</p>
		</div>
	</header>

	<section>
		<h2>{m.how.pairTitle}</h2>
		<ol>
			<li>{m.how.step1}</li>
			<li>{m.how.step2}</li>
			<li><RichText text={fill(m.how.step3, { seconds: PAIRING_SECONDS })} /></li>
			<li><RichText text={m.how.step4} /></li>
		</ol>
		<p class="warn">
			{m.how.warn}
		</p>
		<ol class="cont">
			<li><RichText text={m.how.step5} /></li>
		</ol>
	</section>

	<section id="check">
		<h2>{m.how.checkTitle}</h2>
		<p>
			{m.how.check1}
		</p>
		<p>
			{m.how.check2}
		</p>
		<p>
			{m.how.check3}
		</p>
		<p>
			{m.how.check4}
		</p>
	</section>

	<section>
		<h2>{m.how.secretTitle}</h2>
		<div class="split">
			<div>
				<h3>{m.how.onDeviceTitle}</h3>
				<ul>
					<li>{m.how.onDevice1}</li>
					<li>{m.how.onDevice2}</li>
					<li>
						{m.how.onDevice3}
					</li>
					<li>
						{m.how.onDevice4}
					</li>
				</ul>
			</div>
			<div>
				<h3>{m.how.onServerTitle}</h3>
				<ul>
					<li>{m.how.onServer1}</li>
					<li>{m.how.onServer2}</li>
					<li>{m.how.onServer3}</li>
				</ul>
			</div>
		</div>
		<p>
			{m.how.selfHost}
		</p>
	</section>

	<section>
		<h2>{m.how.trustTitle}</h2>
		<p>
			{m.how.trustIntro}
		</p>
		<ul class="trust">
			<li>
				<strong>{m.how.trustCheckTitle}</strong>
				{m.how.trustCheckBody}
			</li>
			<li>
				<strong>{m.how.trustCodeTitle}</strong>
				{m.how.trustCodeBody}
			</li>
			<li>
				<strong>{m.how.trustSmallTitle}</strong>
				{m.how.trustSmallBody}
			</li>
			<li>
				<strong>{m.how.trustPinTitle}</strong>
				{m.how.trustPinBody}
			</li>
		</ul>
		<p>{m.how.pastePrompt}</p>
		<div class="prompt">
			<pre>{m.how.prompt}</pre>
			<button type="button" class="ghost" onclick={copyPrompt}>
				<Icon name={copied ? 'check' : 'copy'} size={16} />
				{copied ? m.common.copied : m.common.copy}
			</button>
		</div>
		<p class="out">
			<a href={github} target="_blank" rel="noreferrer">{m.how.sourceGithub}</a>
			<span aria-hidden="true">·</span>
			<a href={scorecard} target="_blank" rel="noreferrer">{m.how.scorecard}</a>
		</p>
	</section>

	<p class="foot">
		<a href={resolve('/')}>{m.common.backToPairing}</a>
		<span aria-hidden="true"> · </span>
		<a href={resolve('/whats-new')}>{m.common.whatsNew}</a>
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

	h2 {
		margin: 0 0 12px;
		font-size: 18px;
		text-transform: none;
		letter-spacing: -0.02em;
		color: var(--ink);
		font-weight: 600;
	}

	h3 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink3);
	}

	section p,
	section li {
		margin: 0;
		color: var(--ink2);
		font-size: 16px;
		line-height: 24px;
	}

	section p + p,
	section ol + p,
	section p + ol,
	section ul + p,
	.split + p,
	.trust + p {
		margin-top: 12px;
	}

	ol.cont {
		counter-reset: step 4;
	}

	section p.warn {
		padding-left: 36px;
		color: var(--ink);
		font-weight: 600;
	}

	ol,
	ul {
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	ol {
		list-style: none;
		counter-reset: step;
	}

	ol li {
		position: relative;
		padding-left: 36px;
		counter-increment: step;
	}

	ol li::before {
		content: counter(step);
		position: absolute;
		left: 0;
		top: 1px;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-pill);
		background: var(--chip);
		border: 1px solid var(--line);
		color: var(--ink);
		font-size: 12px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	ul {
		list-style: none;
	}

	ul li {
		padding-left: 16px;
		position: relative;
	}

	ul li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 10px;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--ink3);
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px 28px;
		margin-top: 4px;
	}

	.trust li {
		padding-left: 0;
	}

	.trust li::before {
		display: none;
	}

	.trust strong {
		display: block;
		color: var(--ink);
		font-weight: 600;
		margin-bottom: 2px;
	}

	.prompt {
		margin-top: 12px;
		padding: 14px 16px 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius-inset);
		background: var(--inset);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}

	.prompt pre {
		margin: 0;
		white-space: pre-wrap;
		font-size: 13px;
		line-height: 20px;
		color: var(--ink);
	}

	.prompt button {
		height: 36px;
		padding: 0 16px;
		font-size: 14px;
	}

	.out {
		margin-top: 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 10px;
		align-items: center;
		font-size: 14px;
	}

	@media (max-width: 720px) {
		.top {
			gap: 12px;
		}

		.split {
			grid-template-columns: 1fr;
			gap: 18px;
		}

		section p,
		section li {
			font-size: 15px;
			line-height: 22px;
		}
	}
</style>
