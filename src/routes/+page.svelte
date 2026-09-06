<script lang="ts">
	import { onMount } from 'svelte';
	import { base64ToBytes, bytesToBase64 } from '$lib/crypto/bytes';
	import { decrypt, encrypt } from '$lib/crypto/ecies';
	import { fingerprintFromBytes } from '$lib/crypto/fingerprint';
	import { loadOrCreateEndpoint, saveEndpointName } from '$lib/crypto/keys';
	import { deleteChannel, listChannels, putChannel } from '$lib/db';
	import type { Channel, ChannelEvent, Endpoint, PairEvent } from '$lib/types';

	let endpoint = $state<Endpoint | null>(null);
	let channels = $state<Channel[]>([]);
	let selectedKey = $state<string | null>(null);
	let loadError = $state('');
	let pairing = $state(false);
	let pairingSeconds = $state(30);
	let pairingNote = $state('');
	let peerReady = $state(false);
	let draft = $state('');
	let lastReceived = $state('');
	let sendNote = $state('');
	let sending = $state(false);

	const selected = $derived(channels.find((c) => c.peerPublicKey === selectedKey) ?? null);

	let pairSource: EventSource | null = null;
	let pairTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		void (async () => {
			try {
				endpoint = await loadOrCreateEndpoint();
				channels = await listChannels();
			} catch (err) {
				loadError = err instanceof Error ? err.message : 'Could not create a device key';
			}
		})();
		return () => {
			stopPairing(false);
		};
	});

	$effect(() => {
		const selfKey = endpoint?.publicKey;
		const privateKey = endpoint?.privateKey;
		const peer = selectedKey;
		if (!selfKey || !privateKey || !peer) {
			peerReady = false;
			return;
		}
		lastReceived = '';
		sendNote = '';
		peerReady = false;
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

	async function onNameInput(event: Event) {
		if (!endpoint) return;
		const name = (event.target as HTMLInputElement).value;
		endpoint.name = name;
		await saveEndpointName(endpoint, name);
	}

	function stopPairing(notifyServer: boolean) {
		pairing = false;
		if (pairTimer) {
			clearInterval(pairTimer);
			pairTimer = null;
		}
		if (pairSource) {
			pairSource.close();
			pairSource = null;
		}
		if (notifyServer && endpoint) {
			void fetch('/api/pair/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publicKey: endpoint.publicKey })
			});
		}
	}

	function startPairing() {
		if (!endpoint || pairing) return;
		pairingNote = '';
		pairing = true;
		pairingSeconds = 30;
		const url = `/api/pair/events?publicKey=${encodeURIComponent(endpoint.publicKey)}&name=${encodeURIComponent(endpoint.name)}`;
		pairSource = new EventSource(url);
		pairTimer = setInterval(() => {
			pairingSeconds = Math.max(0, pairingSeconds - 1);
		}, 1000);
		pairSource.onmessage = async (event) => {
			const payload = JSON.parse(event.data) as PairEvent;
			if (payload.type === 'waiting') return;
			if (payload.type === 'timeout') {
				stopPairing(false);
				pairingNote = 'Pairing timed out. Try again with both devices.';
				return;
			}
			if (payload.type === 'cancelled') {
				stopPairing(false);
				return;
			}
			if (payload.type === 'paired') {
				const peerRaw = base64ToBytes(payload.peerPublicKey);
				const channel: Channel = {
					peerPublicKey: payload.peerPublicKey,
					peerFingerprint: await fingerprintFromBytes(peerRaw),
					peerName: payload.peerName,
					localAlias: '',
					peerIp: payload.peerIp
				};
				await putChannel(channel);
				channels = await listChannels();
				selectedKey = channel.peerPublicKey;
				stopPairing(false);
			}
		};
		pairSource.onerror = () => {
			if (!pairing) return;
			stopPairing(false);
			pairingNote = 'Pairing connection dropped.';
		};
	}

	async function onAliasInput(channel: Channel, event: Event) {
		const localAlias = (event.target as HTMLInputElement).value;
		const updated = { ...channel, localAlias };
		await putChannel(updated);
		channels = channels.map((c) => (c.peerPublicKey === channel.peerPublicKey ? updated : c));
	}

	async function removeChannel(channel: Channel, event: Event) {
		event.stopPropagation();
		await deleteChannel(channel.peerPublicKey);
		channels = channels.filter((c) => c.peerPublicKey !== channel.peerPublicKey);
		if (selectedKey === channel.peerPublicKey) {
			selectedKey = null;
		}
	}

	async function sendMessage() {
		if (!endpoint || !selected || !peerReady || sending) return;
		const text = draft;
		if (!text) return;
		sending = true;
		sendNote = '';
		try {
			const ciphertext = await encrypt(
				new TextEncoder().encode(text),
				base64ToBytes(selected.peerPublicKey)
			);
			const res = await fetch('/api/channel/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: endpoint.publicKey,
					to: selected.peerPublicKey,
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
			sendNote = 'Sent.';
		} catch {
			sendNote = 'Send failed.';
		} finally {
			sending = false;
		}
	}

	function channelLabel(channel: Channel): string {
		if (channel.localAlias && channel.peerName) {
			return `${channel.localAlias} (${channel.peerName})`;
		}
		return channel.localAlias || channel.peerName || 'Unnamed endpoint';
	}
</script>

<svelte:head>
	<title>XChan</title>
</svelte:head>

<main>
	<header>
		<h1>XChan</h1>
		<p class="lede">Pair two devices and send an ephemeral secret. The server only relays.</p>
	</header>

	{#if loadError}
		<p class="error">{loadError}</p>
	{:else if !endpoint}
		<p class="muted">Creating a device key…</p>
	{:else}
		<section>
			<h2>This endpoint</h2>
			<p>
				<span class="label">Endpoint fingerprint</span>
				<code>{endpoint.fingerprint}</code>
			</p>
			<label>
				Name
				<input
					type="text"
					maxlength="64"
					placeholder="MacBook, Pixel…"
					value={endpoint.name}
					oninput={onNameInput}
				/>
			</label>
			<div class="row">
				{#if pairing}
					<button type="button" onclick={() => stopPairing(true)}>Cancel pairing</button>
					<span class="muted">Waiting for a pair… {pairingSeconds}s</span>
				{:else}
					<button type="button" onclick={startPairing}>Pair</button>
				{/if}
			</div>
			{#if pairingNote}
				<p class="error">{pairingNote}</p>
			{/if}
		</section>

		<section>
			<h2>Channels</h2>
			{#if channels.length === 0}
				<p class="muted">
					No pairings yet. Open this app on another device and press Pair on both.
				</p>
			{:else}
				<ul class="channels">
					{#each channels as channel (channel.peerPublicKey)}
						<li>
							<button
								type="button"
								class="channel"
								class:selected={selectedKey === channel.peerPublicKey}
								onclick={() => (selectedKey = channel.peerPublicKey)}
							>
								<strong>{channelLabel(channel)}</strong>
								<code>{channel.peerFingerprint}</code>
								<span class="muted">{channel.peerIp || 'IP unknown'}</span>
							</button>
							<label class="alias">
								Your name for them
								<input
									type="text"
									maxlength="64"
									placeholder="optional"
									value={channel.localAlias}
									oninput={(event) => onAliasInput(channel, event)}
								/>
							</label>
							<button
								type="button"
								class="danger"
								onclick={(event) => removeChannel(channel, event)}
							>
								Delete
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if selected}
			<section>
				<h2>Send</h2>
				<p>
					Peer status:
					<strong class={peerReady ? 'ready' : 'waiting'}>{peerReady ? 'ready' : 'waiting'}</strong>
				</p>
				<p class="muted">
					Both devices must select this channel. Messages are encrypted to the peer public key and
					are not stored.
				</p>
				<textarea
					rows="5"
					placeholder="Password or other short secret"
					bind:value={draft}
					onkeydown={(event) => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							void sendMessage();
						}
					}}></textarea>
				<div class="row">
					<button type="button" disabled={!peerReady || !draft || sending} onclick={sendMessage}>
						Send
					</button>
					{#if sendNote}
						<span class="muted">{sendNote}</span>
					{/if}
				</div>
				{#if lastReceived}
					<div class="received">
						<span class="label">Last received</span>
						<pre>{lastReceived}</pre>
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</main>

<style>
	:global(html, body) {
		margin: 0;
		min-height: 100%;
		background: #11150f;
		color: #e8eedf;
		font:
			16px/1.45 ui-sans-serif,
			system-ui,
			sans-serif;
	}

	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		letter-spacing: -0.03em;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #b7c4a4;
	}

	.lede,
	.muted {
		color: #9aa68c;
	}

	section {
		margin-top: 1.75rem;
		padding: 1rem 1rem 1.1rem;
		border: 1px solid #2c3526;
		border-radius: 12px;
		background: #181d16;
	}

	label,
	.label {
		display: block;
		margin: 0.75rem 0 0.35rem;
		color: #b7c4a4;
		font-size: 0.85rem;
	}

	input,
	textarea,
	button {
		font: inherit;
		color: inherit;
	}

	input,
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 0.7rem;
		border: 1px solid #3b4633;
		border-radius: 8px;
		background: #10140e;
	}

	textarea {
		resize: vertical;
	}

	button {
		padding: 0.55rem 0.9rem;
		border: 0;
		border-radius: 8px;
		background: #c6e38a;
		color: #16200c;
		font-weight: 650;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	button.danger {
		background: transparent;
		color: #e7a7a0;
		border: 1px solid #5a3330;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.85rem;
	}

	code,
	pre {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	code {
		display: inline-block;
		padding: 0.15rem 0.4rem;
		border-radius: 6px;
		background: #10140e;
	}

	.channels {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.85rem;
	}

	.channels li {
		display: grid;
		gap: 0.5rem;
	}

	.channel {
		display: grid;
		gap: 0.2rem;
		width: 100%;
		text-align: left;
		background: #10140e;
		color: inherit;
		border: 1px solid #3b4633;
	}

	.channel.selected {
		border-color: #c6e38a;
	}

	.alias input {
		margin-top: 0.25rem;
	}

	.error {
		color: #f0b4ad;
	}

	.ready {
		color: #c6e38a;
	}

	.waiting {
		color: #e6c37a;
	}

	.received pre {
		margin: 0.35rem 0 0;
		padding: 0.75rem;
		white-space: pre-wrap;
		word-break: break-word;
		background: #10140e;
		border-radius: 8px;
	}
</style>
