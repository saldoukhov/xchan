<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		channelLabel,
		channelPeerName,
		channelTitle,
		findChannelBySlug,
		themCardNames
	} from '$lib/channel';
	import { base64ToBytes, bytesToBase64 } from '$lib/crypto/bytes';
	import { decrypt, encrypt } from '$lib/crypto/ecies';
	import { decryptName, encryptName } from '$lib/name';
	import { loadOrCreateEndpoint } from '$lib/crypto/keys';
	import { listChannels, putChannel } from '$lib/db';
	import Icon from '$lib/Icon.svelte';
	import IdentityCard from '$lib/IdentityCard.svelte';
	import type { Channel, ChannelEvent, Endpoint } from '$lib/types';

	const MAX_MESSAGE_CHARS = 512;

	let endpoint = $state<Endpoint | null>(null);
	let channel = $state<Channel | null>(null);
	let loadError = $state('');
	let missing = $state(false);
	let peerReady = $state(false);
	let draft = $state('');
	let lastReceived = $state('');
	let receivedAt = $state<Date | null>(null);
	let sendNote = $state('');
	let sending = $state(false);
	let copied = $state(false);
	let sent = $state(false);
	let compareOpen = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let sentTimer: ReturnType<typeof setTimeout> | null = null;

	const slug = $derived(page.params.slug ?? '');
	const title = $derived(channel ? `XChan · ${channelLabel(channel)}` : 'XChan');
	const heading = $derived(channel ? channelTitle(channel) : '');
	const peerName = $derived(channel ? channelPeerName(channel) : '');
	const draftCount = $derived(draft.length);
	const canSend = $derived(peerReady && draft.length > 0 && !sending);
	const receivedClock = $derived(receivedAt ? formatClock(receivedAt) : '');

	onMount(() => {
		return () => {
			if (copyTimer) clearTimeout(copyTimer);
			if (sentTimer) clearTimeout(sentTimer);
		};
	});

	function formatClock(date: Date) {
		return date.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	$effect(() => {
		const currentSlug = slug;
		let cancelled = false;
		missing = false;
		channel = null;
		void (async () => {
			try {
				const ep = await loadOrCreateEndpoint();
				const found = findChannelBySlug(await listChannels(), currentSlug) ?? null;
				if (cancelled) return;
				endpoint = ep;
				channel = found;
				missing = !found;
			} catch (err) {
				if (!cancelled) {
					loadError = err instanceof Error ? err.message : 'Could not open this channel';
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const selfKey = channel?.localPublicKey;
		const privateKey = channel?.localPrivateKey;
		const peer = channel?.peerPublicKey;
		const selfName = endpoint?.name ?? '';
		if (!selfKey || !privateKey || !peer) {
			peerReady = false;
			return;
		}
		lastReceived = '';
		receivedAt = null;
		sendNote = '';
		peerReady = false;
		draft = '';
		copied = false;
		sent = false;
		compareOpen = false;
		let cancelled = false;
		let es: EventSource | null = null;
		void (async () => {
			let nameCiphertext: string;
			try {
				nameCiphertext = await encryptName(selfName, peer);
			} catch {
				if (!cancelled) sendNote = 'Could not open this channel.';
				return;
			}
			if (cancelled) return;
			const url = `/api/channel/events?self=${encodeURIComponent(selfKey)}&peer=${encodeURIComponent(peer)}&nameCiphertext=${encodeURIComponent(nameCiphertext)}`;
			es = new EventSource(url);
			if (cancelled) {
				es.close();
				return;
			}
			es.onmessage = async (event) => {
				const payload = JSON.parse(event.data) as ChannelEvent;
				if (payload.type === 'status') {
					peerReady = payload.ready;
					if (payload.ready && payload.peerNameCiphertext) {
						try {
							const decryptedName = await decryptName(payload.peerNameCiphertext, privateKey);
							const current = channel;
							if (current && decryptedName !== current.peerName) {
								current.peerName = decryptedName;
								void putChannel({ ...current, peerName: decryptedName });
							}
						} catch {
							// ignore a name the pairing key cannot decrypt
						}
					}
					return;
				}
				if (payload.type === 'message') {
					try {
						const plain = await decrypt(base64ToBytes(payload.ciphertext), privateKey);
						lastReceived = new TextDecoder().decode(plain);
						receivedAt = new Date();
						sendNote = '';
					} catch {
						sendNote = 'Received a message that could not be decrypted.';
					}
				}
			};
			es.onerror = () => {
				peerReady = false;
			};
		})();
		return () => {
			cancelled = true;
			es?.close();
		};
	});

	async function sendMessage() {
		if (!channel || !peerReady || sending) return;
		const text = draft.slice(0, MAX_MESSAGE_CHARS);
		if (!text) return;
		sending = true;
		sendNote = '';
		try {
			const ciphertext = await encrypt(
				new TextEncoder().encode(text),
				base64ToBytes(channel.peerPublicKey)
			);
			const res = await fetch('/api/channel/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: channel.localPublicKey,
					to: channel.peerPublicKey,
					ciphertext: bytesToBase64(ciphertext)
				})
			});
			if (res.status === 409) {
				sendNote = 'Peer is not ready.';
				peerReady = false;
				return;
			}
			if (!res.ok) {
				sendNote = 'Send failed.';
				return;
			}
			draft = '';
			sent = true;
			if (sentTimer) clearTimeout(sentTimer);
			sentTimer = setTimeout(() => {
				sent = false;
				sentTimer = null;
			}, 1500);
		} catch {
			sendNote = 'Send failed.';
		} finally {
			sending = false;
		}
	}

	async function copyReceived() {
		if (!lastReceived) return;
		try {
			await navigator.clipboard.writeText(lastReceived);
			copied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copied = false;
				copyTimer = null;
			}, 1500);
		} catch {
			sendNote = 'Copy failed.';
		}
	}

	function onDraftInput(event: Event) {
		const el = event.currentTarget as HTMLTextAreaElement;
		if (el.value.length > MAX_MESSAGE_CHARS) {
			el.value = el.value.slice(0, MAX_MESSAGE_CHARS);
		}
		draft = el.value;
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="channel-screen">
	{#if loadError}
		<nav class="top">
			<a class="icon outlined" href={resolve('/')} aria-label="Back to home">
				<Icon name="back" size={20} />
			</a>
		</nav>
		<p class="error">{loadError}</p>
	{:else if missing}
		<nav class="top">
			<a class="icon outlined" href={resolve('/')} aria-label="Back to home">
				<Icon name="back" size={20} />
			</a>
		</nav>
		<p class="muted">This channel is not on this device.</p>
	{:else if !channel}
		<nav class="top">
			<a class="icon outlined" href={resolve('/')} aria-label="Back to home">
				<Icon name="back" size={20} />
			</a>
		</nav>
		<p class="muted">Opening channel…</p>
	{:else}
		<nav class="top">
			<div class="who">
				<a class="icon outlined" href={resolve('/')} aria-label="Back to home">
					<Icon name="back" size={20} />
				</a>
				<img class="peer-hash" src={channel.peerLifeHash} width="40" height="40" alt="" />
				<div class="who-text">
					<h1 class="who-title">{heading}</h1>
					<div class="who-sub">
						{#if peerName && peerName !== heading}
							<span>{peerName}</span>
						{/if}
						{#if channel.peerIp}
							<span class="who-ip"
								>{peerName && peerName !== heading ? ' · ' : ''}{channel.peerIp}</span
							>
						{/if}
					</div>
				</div>
			</div>
			<div class="status {peerReady ? 'is-ready' : 'is-waiting'}">
				<span class="dot"></span>
				{peerReady ? 'Ready' : 'Waiting'}
			</div>
		</nav>

		<section class="compare">
			{#if compareOpen}
				<div class="full-cards">
					<IdentityCard
						title="Us"
						names={[endpoint?.name || 'Unnamed']}
						lifeHash={channel.localLifeHash}
						words={channel.localWords}
					/>
					<IdentityCard
						title="Them"
						names={themCardNames(channel)}
						lifeHash={channel.peerLifeHash}
						words={channel.peerWords}
					/>
				</div>
			{:else}
				<div class="summaries">
					<IdentityCard
						variant="row"
						title="Us"
						names={[endpoint?.name || 'Unnamed']}
						lifeHash={channel.localLifeHash}
						words={channel.localWords}
					/>
					<div class="vsplit"></div>
					<div class="hsplit"></div>
					<IdentityCard
						variant="row"
						title="Them"
						names={themCardNames(channel)}
						lifeHash={channel.peerLifeHash}
						words={channel.peerWords}
					/>
				</div>
			{/if}
			<div class="compare-foot">
				<p class="hint">
					<span class="hint-long">Check both cards against the other device before you send.</span>
					<span class="hint-short">Check both cards on the other device.</span>
				</p>
				<button type="button" class="compare-btn" onclick={() => (compareOpen = !compareOpen)}>
					<span class="compare-long">Compare All 24 Words</span>
					<span class="compare-short">24 Words</span>
					<Icon name={compareOpen ? 'unfold-less' : 'unfold-more'} size={18} />
				</button>
			</div>
		</section>

		<div class="panels">
			<section class="pane">
				<span class="kicker">Send</span>
				<textarea
					spellcheck="false"
					autocomplete="off"
					placeholder="Type or paste a short secret"
					maxlength={MAX_MESSAGE_CHARS}
					value={draft}
					oninput={onDraftInput}
					onkeydown={(event) => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							void sendMessage();
						}
					}}></textarea>
				<div class="pane-foot">
					<span class="count">{draftCount} / {MAX_MESSAGE_CHARS}</span>
					<button
						type="button"
						class={peerReady || sent ? '' : 'quiet'}
						disabled={!canSend}
						onclick={sendMessage}
					>
						<Icon name={sent ? 'check' : 'send'} size={18} />
						{sent ? 'Sent' : 'Send'}
					</button>
				</div>
				{#if sendNote}
					<p class="error send-error">{sendNote}</p>
				{:else if !peerReady}
					<p class="hint wait-note">
						Both devices must be on this channel. Waiting for {heading}.
					</p>
				{/if}
			</section>

			<section class="pane">
				<div class="pane-head">
					<span class="kicker">Received</span>
					{#if receivedClock}
						<span class="count">{receivedClock}</span>
					{/if}
				</div>
				<div class="received-body" aria-readonly="true">
					{#if lastReceived}
						<pre>{lastReceived}</pre>
					{/if}
				</div>
				<div class="pane-foot">
					<span class="hint">Cleared when you leave.</span>
					<button
						type="button"
						class="ghost"
						onclick={copyReceived}
						disabled={!lastReceived}
						aria-label={copied ? 'Copied' : 'Copy received message'}
					>
						<Icon name={copied ? 'check' : 'copy'} size={18} />
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
			</section>
		</div>
	{/if}
</main>

<style>
	.channel-screen {
		gap: 24px;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
	}

	.peer-hash {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-inset);
		image-rendering: pixelated;
		flex: none;
		background: var(--inset);
	}

	.who-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.who-title {
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.01em;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.who-sub {
		font-size: 14px;
		color: var(--ink3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		height: 36px;
		padding: 0 18px;
		border-radius: var(--radius-pill);
		background: var(--pill);
		border: 1px solid var(--line);
		font-size: 15px;
		font-weight: 500;
		flex: none;
		color: var(--ink);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-pill);
		background: currentColor;
	}

	.is-ready .dot {
		background: var(--ready);
		box-shadow: 0 0 0 4px var(--ready-glow);
	}

	.is-waiting .dot {
		background: var(--waiting);
		box-shadow: 0 0 0 4px var(--waiting-glow);
	}

	.compare {
		padding: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.summaries {
		display: flex;
		align-items: stretch;
	}

	.summaries :global(.row-card) {
		flex: 1;
		min-width: 0;
	}

	.vsplit {
		width: 1px;
		background: var(--line);
		flex: none;
	}

	.hsplit {
		display: none;
		height: 1px;
		background: var(--line);
	}

	.full-cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 16px;
		padding: 16px;
		min-width: 0;
	}

	.full-cards :global(.card) {
		background: var(--inset);
	}

	.compare-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 22px;
		border-top: 1px solid var(--line);
	}

	.compare-foot .hint {
		margin: 0;
	}

	.hint-short,
	.compare-short {
		display: none;
	}

	.compare-btn {
		height: auto;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
		color: var(--link);
		font-size: 15px;
		font-weight: 500;
		gap: 6px;
		flex: none;
	}

	.compare-btn:hover:not(:disabled) {
		filter: none;
		color: var(--accent);
	}

	.panels {
		display: flex;
		gap: 20px;
		align-items: stretch;
	}

	.pane {
		flex: 1;
		min-width: 0;
		padding: 20px 22px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.pane textarea,
	.received-body {
		height: 120px;
		margin: 0;
		padding: 12px 14px;
		border-radius: var(--radius-inset);
		background: var(--inset);
		border: 1px solid var(--line);
		box-sizing: border-box;
	}

	.received-body {
		overflow: auto;
		color: var(--ink);
		cursor: default;
		user-select: text;
	}

	.received-body pre {
		margin: 0;
		font-family: var(--mono);
		font-size: 15px;
		line-height: 24px;
		color: var(--ink);
		white-space: pre-wrap;
		word-break: break-word;
		cursor: text;
	}

	.pane-head,
	.pane-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.count {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink3);
	}

	.send-error,
	.wait-note {
		margin: 0;
	}

	.wait-note {
		display: none;
	}

	@media (max-width: 720px) {
		.channel-screen {
			gap: 18px;
		}

		.top {
			gap: 12px;
		}

		.who {
			gap: 12px;
		}

		.peer-hash {
			display: none;
		}

		.who-title {
			font-size: 19px;
		}

		.who-sub {
			font-size: 13px;
		}

		.who-ip {
			display: none;
		}

		.status {
			height: 32px;
			padding: 0 14px;
			font-size: 14px;
			gap: 8px;
		}

		.dot {
			width: 7px;
			height: 7px;
		}

		.summaries {
			flex-direction: column;
		}

		.vsplit {
			display: none;
		}

		.hsplit {
			display: block;
		}

		.full-cards {
			grid-template-columns: 1fr;
			padding: 12px;
			gap: 12px;
		}

		.compare-foot {
			padding: 12px 16px;
			gap: 12px;
		}

		.hint-long,
		.compare-long {
			display: none;
		}

		.hint-short,
		.compare-short {
			display: inline;
		}

		.compare-foot .hint {
			max-width: 180px;
			font-size: 13px;
			line-height: 18px;
		}

		.compare-btn {
			font-size: 14px;
			gap: 4px;
		}

		.panels {
			flex-direction: column;
			gap: 16px;
		}

		.pane {
			padding: 16px;
			gap: 12px;
		}

		.pane textarea {
			height: 92px;
		}

		.pane-foot .count {
			display: none;
		}

		.pane-foot button {
			width: 100%;
			height: 48px;
		}

		.pane:first-child .pane-foot {
			flex-direction: column;
			align-items: stretch;
		}

		.wait-note {
			display: block;
			font-size: 13px;
			line-height: 18px;
		}

		.pane:last-child .pane-foot {
			align-items: center;
		}

		.pane:last-child .pane-foot button {
			width: auto;
			height: 40px;
			padding: 0 20px;
			font-size: 15px;
		}
	}
</style>
