<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { channelLabel, findChannelBySlug } from '$lib/channel';
	import { base64ToBytes, bytesToBase64 } from '$lib/crypto/bytes';
	import { decrypt, encrypt } from '$lib/crypto/ecies';
	import { loadOrCreateEndpoint } from '$lib/crypto/keys';
	import { listChannels } from '$lib/db';
	import Icon from '$lib/Icon.svelte';
	import type { Channel, ChannelEvent, Endpoint } from '$lib/types';

	let endpoint = $state<Endpoint | null>(null);
	let channel = $state<Channel | null>(null);
	let loadError = $state('');
	let missing = $state(false);
	let peerReady = $state(false);
	let draft = $state('');
	let lastReceived = $state('');
	let sendNote = $state('');
	let sending = $state(false);
	let copied = $state(false);
	let sent = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let sentTimer: ReturnType<typeof setTimeout> | null = null;

	const slug = $derived(page.params.slug ?? '');
	const title = $derived(channel ? `XChan · ${channelLabel(channel)}` : 'XChan');

	onMount(() => {
		return () => {
			if (copyTimer) clearTimeout(copyTimer);
			if (sentTimer) clearTimeout(sentTimer);
		};
	});

	$effect(() => {
		const currentSlug = slug;
		let cancelled = false;
		missing = false;
		channel = null;
		void (async () => {
			try {
				const ep = await loadOrCreateEndpoint();
				if (cancelled) return;
				endpoint = ep;
				const found = findChannelBySlug(await listChannels(), currentSlug) ?? null;
				if (cancelled) return;
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
		const selfKey = endpoint?.publicKey;
		const privateKey = endpoint?.privateKey;
		const peer = channel?.peerPublicKey;
		if (!selfKey || !privateKey || !peer) {
			peerReady = false;
			return;
		}
		lastReceived = '';
		sendNote = '';
		peerReady = false;
		draft = '';
		copied = false;
		sent = false;
		const url = `/api/channel/events?self=${encodeURIComponent(selfKey)}&peer=${encodeURIComponent(peer)}`;
		const es = new EventSource(url);
		es.onmessage = async (event) => {
			const payload = JSON.parse(event.data) as ChannelEvent;
			if (payload.type === 'status') {
				peerReady = payload.ready;
				return;
			}
			if (payload.type === 'message') {
				try {
					const plain = await decrypt(base64ToBytes(payload.ciphertext), privateKey);
					lastReceived = new TextDecoder().decode(plain);
					sendNote = '';
				} catch {
					sendNote = 'Received a message that could not be decrypted.';
				}
			}
		};
		es.onerror = () => {
			peerReady = false;
		};
		return () => {
			es.close();
		};
	});

	async function sendMessage() {
		if (!endpoint || !channel || !peerReady || sending) return;
		const text = draft;
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
					from: endpoint.publicKey,
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
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#snippet homeBtn()}
	<a class="icon xl" href={resolve('/')} aria-label="Home" title="Home">
		<Icon name="home" size={72} />
	</a>
{/snippet}

<main class="channel-screen">
	{#if loadError}
		<nav>{@render homeBtn()}</nav>
		<p class="error">{loadError}</p>
	{:else if missing}
		<nav>{@render homeBtn()}</nav>
		<p class="muted">This channel is not on this device.</p>
	{:else if !endpoint || !channel}
		<nav>{@render homeBtn()}</nav>
		<p class="muted">Opening channel…</p>
	{:else}
		<nav>
			{@render homeBtn()}
			<span class="status {peerReady ? 'ready' : 'waiting'}">
				<span class="dot"></span>
				{peerReady ? 'ready' : 'waiting'}
			</span>
		</nav>
		<div class="stage">
			<div class="panels">
				<section class="pane">
					<header>
						<span class="label">Send</span>
						<button
							type="button"
							class="icon lg send"
							class:sent
							disabled={!peerReady || !draft || sending}
							onclick={sendMessage}
							aria-label={sent ? 'Sent' : 'Send'}
						>
							<Icon name={sent ? 'check' : 'send'} size={36} />
						</button>
					</header>
					<div class="compose">
						<textarea
							spellcheck="false"
							autocomplete="off"
							bind:value={draft}
							onkeydown={(event) => {
								if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
									event.preventDefault();
									void sendMessage();
								}
							}}></textarea>
						{#if sendNote}
							<p class="error send-error">{sendNote}</p>
						{/if}
					</div>
				</section>
				<section class="pane">
					<header>
						<span class="label">Received</span>
						<button
							type="button"
							class="icon lg"
							class:copied
							onclick={copyReceived}
							disabled={!lastReceived}
							aria-label={copied ? 'Copied' : 'Copy received message'}
						>
							<Icon name={copied ? 'check' : 'copy'} size={36} />
						</button>
					</header>
					<div class="received-body" aria-readonly="true">
						{#if lastReceived}
							<pre>{lastReceived}</pre>
						{/if}
					</div>
				</section>
			</div>
		</div>
	{/if}
</main>

<style>
	.channel-screen {
		max-width: 64rem;
		height: 100dvh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.56rem 1.4rem 0.56rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 1.64rem;
		font-weight: 650;
		letter-spacing: 0.02em;
		text-transform: lowercase;
	}

	.dot {
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: currentColor;
	}

	.stage {
		flex: 1;
		min-height: 0;
		display: flex;
		padding-block: clamp(0.75rem, 4vh, 2.25rem);
		overflow: auto;
	}

	.panels {
		flex: 1;
		width: 100%;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
		gap: 1rem;
		align-items: stretch;
	}

	.pane {
		margin: 0;
		min-height: 11rem;
		height: auto;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		box-shadow: none;
	}

	.pane header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		flex-shrink: 0;
	}

	.copied {
		color: var(--accent);
	}

	.sent:disabled {
		opacity: 1;
	}

	.compose {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
	}

	.send-error {
		position: absolute;
		left: 0.85rem;
		bottom: 0.7rem;
		margin: 0;
		font-size: 0.88rem;
		pointer-events: none;
	}

	.pane textarea,
	.received-body {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 10px;
	}

	.pane textarea {
		background: #1c2418;
		border: 1px solid var(--line-strong);
		caret-color: var(--accent);
	}

	.received-body {
		overflow: auto;
		background: #0b0e0a;
		border: 1px solid transparent;
		border-left: 3px solid var(--line-strong);
		border-radius: 4px 10px 10px 4px;
		box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.35);
		color: var(--muted);
		cursor: default;
		user-select: text;
	}

	.received-body pre {
		margin: 0;
		color: var(--ink);
		white-space: pre-wrap;
		word-break: break-word;
		cursor: text;
	}

	@media (min-width: 720px) {
		.stage {
			align-items: center;
		}

		.panels {
			flex: none;
			height: 50%;
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr;
			gap: 1.15rem;
		}
	}

	@media (max-width: 480px) {
		.channel-screen {
			padding: 0.85rem 0.9rem;
		}
	}
</style>
