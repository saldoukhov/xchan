<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { channelSlug, findChannelByPeerIdentity, mergeChannel } from '$lib/channel';
	import { base64ToBytes } from '$lib/crypto/bytes';
	import { identityFromPublicKeyRaw } from '$lib/crypto/fingerprint';
	import { commitOfPairing } from '$lib/crypto/hash';
	import {
		createPairingOffer,
		loadOrCreateEndpoint,
		resetAndCreateEndpoint,
		saveEndpointName,
		type PairingOffer
	} from '$lib/crypto/keys';
	import { deleteChannel, listChannels, putChannel } from '$lib/db';
	import IdentityCard from '$lib/IdentityCard.svelte';
	import Icon from '$lib/Icon.svelte';
	import { PAIRING_SECONDS } from '$lib/pairing';
	import type { Channel, Endpoint, PairEvent } from '$lib/types';

	let endpoint = $state<Endpoint | null>(null);
	let channels = $state<Channel[]>([]);
	let loadError = $state('');
	let pairing = $state(false);
	let pairingSeconds = $state(PAIRING_SECONDS);
	let pairingNote = $state('');
	let pairingOffer = $state<PairingOffer | null>(null);
	let peerCommit = $state('');
	let resetting = $state(false);

	let editingName = $state(false);
	let nameDraft = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	let editingAliasKey = $state<string | null>(null);
	let aliasDraft = $state('');
	let aliasInput = $state<HTMLInputElement | undefined>(undefined);

	let resetDialog = $state<HTMLDialogElement | undefined>(undefined);

	let pairAbort: AbortController | null = null;
	let pairIgnoreErrors = false;
	let pairTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		void (async () => {
			try {
				endpoint = await loadOrCreateEndpoint();
				channels = await listChannels();
			} catch (err) {
				loadError = err instanceof Error ? err.message : 'Could not load this device';
			}
		})();
		return () => {
			stopPairing(false);
		};
	});

	async function startEditName() {
		if (!endpoint) return;
		nameDraft = endpoint.name;
		editingName = true;
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	function cancelEditName() {
		editingName = false;
		nameDraft = '';
	}

	async function saveName() {
		if (!endpoint) return;
		const name = nameDraft.trim().slice(0, 64);
		endpoint = await saveEndpointName(endpoint, name);
		editingName = false;
	}

	async function startEditAlias(channel: Channel) {
		editingAliasKey = channel.peerIdentityPublicKey;
		aliasDraft = channel.localAlias;
		await tick();
		aliasInput?.focus();
		aliasInput?.select();
	}

	function cancelEditAlias() {
		editingAliasKey = null;
		aliasDraft = '';
	}

	async function saveAlias(channel: Channel) {
		const localAlias = aliasDraft.trim().slice(0, 64);
		const updated = { ...channel, localAlias };
		await putChannel(updated);
		channels = channels.map((c) =>
			c.peerIdentityPublicKey === channel.peerIdentityPublicKey ? updated : c
		);
		cancelEditAlias();
	}

	function closePairSource() {
		if (pairTimer) {
			clearInterval(pairTimer);
			pairTimer = null;
		}
		pairIgnoreErrors = true;
		if (pairAbort) {
			pairAbort.abort();
			pairAbort = null;
		}
	}

	function stopPairing(notifyServer: boolean) {
		const commit = pairingOffer?.commit;
		pairing = false;
		pairingOffer = null;
		peerCommit = '';
		closePairSource();
		if (notifyServer && commit) {
			void fetch('/api/pair/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ commit })
			});
		}
	}

	async function finishPairing(
		offer: PairingOffer,
		payload: Extract<PairEvent, { type: 'paired' }>
	) {
		try {
			if (
				!peerCommit ||
				(await commitOfPairing(payload.peerPublicKey, payload.peerIdentityPublicKey)) !== peerCommit
			) {
				stopPairing(true);
				pairingNote = 'Peer key did not match the commit. Pairing aborted.';
				return;
			}
			if (!endpoint) {
				pairing = false;
				pairingOffer = null;
				pairingNote = 'Paired, but could not open the channel.';
				return;
			}
			if (payload.peerIdentityPublicKey === endpoint.identityPublicKey) {
				stopPairing(true);
				pairingNote = 'This browser is already pairing. Use another browser or device.';
				return;
			}
			const peerRaw = base64ToBytes(payload.peerPublicKey);
			const peerCard = await identityFromPublicKeyRaw(peerRaw);
			const existing = findChannelByPeerIdentity(channels, payload.peerIdentityPublicKey);
			const channel = mergeChannel(existing, {
				localPublicKey: offer.publicKey,
				localPrivateKey: offer.keyPair.privateKey,
				localPublicCryptoKey: offer.keyPair.publicKey,
				localIdentityPublicKey: endpoint.identityPublicKey,
				localWords: offer.identity.words,
				localFingerprint: offer.identity.fingerprint,
				localLifeHash: offer.identity.lifeHash,
				peerPublicKey: payload.peerPublicKey,
				peerIdentityPublicKey: payload.peerIdentityPublicKey,
				peerFingerprint: peerCard.fingerprint,
				peerWords: peerCard.words,
				peerLifeHash: peerCard.lifeHash,
				peerName: payload.peerName,
				localAlias: '',
				peerIp: payload.peerIp
			});
			await putChannel(channel);
			channels = await listChannels();
			pairing = false;
			pairingOffer = null;
			peerCommit = '';
			await goto(resolve('/channel/[slug]', { slug: channelSlug(channel.peerFingerprint) }));
		} catch {
			pairing = false;
			pairingOffer = null;
			pairingNote = 'Paired, but could not open the channel.';
		}
	}

	async function startPairing() {
		if (!endpoint || pairing) return;
		pairingNote = '';
		pairing = true;
		pairingSeconds = PAIRING_SECONDS;
		peerCommit = '';
		pairIgnoreErrors = false;
		let offer: PairingOffer;
		try {
			offer = await createPairingOffer(endpoint.identityPublicKey);
		} catch {
			pairing = false;
			pairingNote = 'Could not create a pairing key.';
			return;
		}
		pairingOffer = offer;
		const controller = new AbortController();
		pairAbort = controller;
		const url = `/api/pair/events?commit=${encodeURIComponent(offer.commit)}&identityPublicKey=${encodeURIComponent(offer.identityPublicKey)}&name=${encodeURIComponent(endpoint.name)}`;
		pairTimer = setInterval(() => {
			pairingSeconds = Math.max(0, pairingSeconds - 1);
			if (pairingSeconds === 0) {
				stopPairing(true);
				pairingNote = 'Pairing timed out. Try again with both devices.';
			}
		}, 1000);
		try {
			const response = await fetch(url, {
				headers: { Accept: 'text/event-stream' },
				signal: controller.signal
			});
			if (!response.ok) {
				const text = (await response.text()).trim();
				stopPairing(false);
				pairingNote = text || 'Could not start pairing.';
				return;
			}
			if (!response.body) {
				stopPairing(false);
				pairingNote = 'Pairing connection dropped.';
				return;
			}
			await readPairEvents(response.body, controller.signal, (payload) => {
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
				if (payload.type === 'rejected') {
					stopPairing(false);
					pairingNote =
						payload.reason === 'same-device'
							? 'This browser is already pairing. Use another browser or device.'
							: 'Pairing was rejected.';
					return;
				}
				if (payload.type === 'reveal') {
					peerCommit = payload.peerCommit;
					void fetch('/api/pair/reveal', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							commit: offer.commit,
							publicKey: offer.publicKey,
							identityPublicKey: offer.identityPublicKey
						})
					}).then(async (res) => {
						if (!res.ok && pairing) {
							stopPairing(true);
							pairingNote = 'Could not reveal pairing key.';
						}
					});
					return;
				}
				if (payload.type === 'paired') {
					pairingNote = '';
					closePairSource();
					void finishPairing(offer, payload);
				}
			});
			if (!pairIgnoreErrors && pairing) {
				stopPairing(false);
				pairingNote = 'Pairing connection dropped.';
			}
		} catch (err) {
			if (pairIgnoreErrors) return;
			if (err instanceof DOMException && err.name === 'AbortError') return;
			if (!pairing) return;
			stopPairing(false);
			pairingNote = 'Pairing connection dropped.';
		}
	}

	async function readPairEvents(
		body: ReadableStream<Uint8Array>,
		signal: AbortSignal,
		onEvent: (payload: PairEvent) => void
	) {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		try {
			while (!signal.aborted) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const chunks = buffer.split('\n\n');
				buffer = chunks.pop() ?? '';
				for (const chunk of chunks) {
					for (const line of chunk.split('\n')) {
						if (!line.startsWith('data:')) continue;
						const json = line.slice(5).trim();
						if (json) onEvent(JSON.parse(json) as PairEvent);
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	async function removeChannel(channel: Channel) {
		await deleteChannel(channel.peerIdentityPublicKey);
		channels = channels.filter((c) => c.peerIdentityPublicKey !== channel.peerIdentityPublicKey);
		if (editingAliasKey === channel.peerIdentityPublicKey) {
			cancelEditAlias();
		}
	}

	function onNameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void saveName();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditName();
		}
	}

	function onAliasKeydown(channel: Channel, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void saveAlias(channel);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditAlias();
		}
	}

	function channelPath(channel: Channel) {
		return resolve('/channel/[slug]', { slug: channelSlug(channel.peerFingerprint) });
	}

	function isChannelRowControl(target: EventTarget | null) {
		return target instanceof Element && Boolean(target.closest('a, button, input, .edit-row'));
	}

	function onChannelRowClick(channel: Channel, event: MouseEvent) {
		if (event.button !== 0 || isChannelRowControl(event.target)) return;
		if (event.metaKey || event.ctrlKey) {
			window.open(channelPath(channel), '_blank');
			return;
		}
		void goto(channelPath(channel));
	}

	function onChannelRowAuxClick(channel: Channel, event: MouseEvent) {
		if (event.button !== 1 || isChannelRowControl(event.target)) return;
		event.preventDefault();
		window.open(channelPath(channel), '_blank');
	}

	function openReset() {
		resetDialog?.showModal();
	}

	function closeReset() {
		resetDialog?.close();
	}

	function onResetDialogClick(event: MouseEvent) {
		if (!resetDialog) return;
		const rect = resetDialog.getBoundingClientRect();
		const inside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!inside) closeReset();
	}

	async function confirmReset() {
		if (resetting) return;
		resetting = true;
		stopPairing(true);
		try {
			endpoint = await resetAndCreateEndpoint();
			channels = [];
			editingName = false;
			editingAliasKey = null;
			pairingNote = '';
			loadError = '';
			closeReset();
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not reset this device';
			closeReset();
		} finally {
			resetting = false;
		}
	}
</script>

<svelte:head>
	<title>XChan</title>
</svelte:head>

<main>
	<header class="top">
		<div>
			<h1>XChan</h1>
			<p class="lede">Pair two devices and send an ephemeral secret. The server only relays.</p>
		</div>
		<button type="button" class="ghost danger reset" onclick={openReset}>Reset</button>
	</header>

	{#if loadError}
		<p class="error">{loadError}</p>
	{:else if !endpoint}
		<p class="muted">Loading…</p>
	{:else}
		<section class="endpoint">
			<div class="section-head">
				<h2>This endpoint</h2>
			</div>
			<div class="endpoint-grid">
				<div class="fact">
					<span class="label">Name</span>
					{#if editingName}
						<div class="edit-row">
							<input
								bind:this={nameInput}
								type="text"
								maxlength="64"
								placeholder="MacBook, Pixel…"
								bind:value={nameDraft}
								onkeydown={onNameKeydown}
							/>
							<button type="button" class="icon" aria-label="Save name" onclick={saveName}>
								<Icon name="check" />
							</button>
							<button type="button" class="icon" aria-label="Cancel" onclick={cancelEditName}>
								<Icon name="close" />
							</button>
						</div>
					{:else}
						<div class="display-row">
							<span class={endpoint.name ? 'value' : 'muted'}>{endpoint.name || 'Unnamed'}</span>
							<button type="button" class="icon" aria-label="Edit name" onclick={startEditName}>
								<Icon name="pencil" />
							</button>
						</div>
					{/if}
				</div>
				{#if pairing}
					<button type="button" class="pair-tile cancel" onclick={() => stopPairing(true)}>
						<span>Cancel</span>
						<strong>{pairingSeconds}s</strong>
					</button>
				{:else}
					<button type="button" class="pair-tile" onclick={startPairing}>Pair</button>
				{/if}
			</div>
			{#if pairingOffer}
				<div class="pair-card">
					<IdentityCard
						title="Us"
						names={[endpoint.name || 'Unnamed']}
						lifeHash={pairingOffer.identity.lifeHash}
						words={pairingOffer.identity.words}
					/>
				</div>
			{/if}
			{#if pairingNote}
				<p class="error note">{pairingNote}</p>
			{/if}
		</section>

		<section>
			<div class="section-head">
				<h2>Channels</h2>
				{#if channels.length > 0}
					<span class="muted count">{channels.length}</span>
				{/if}
			</div>
			{#if channels.length === 0}
				<p class="empty">
					No pairings yet. Open this app on another device and press Pair on both within 15 seconds.
					Compare LifeHash and the word grid before sending.
				</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Peer</th>
								<th>Alias</th>
								<th class="hide-sm">Fingerprint</th>
								<th class="hide-md">IP</th>
								<th><span class="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each channels as channel (channel.peerIdentityPublicKey)}
								<tr
									class="channel-row"
									onclick={(event) => onChannelRowClick(channel, event)}
									onauxclick={(event) => onChannelRowAuxClick(channel, event)}
								>
									<td>
										<div class="peer-cell">
											<img
												class="lifehash-thumb"
												src={channel.peerLifeHash}
												width="64"
												height="64"
												alt=""
											/>
											<div>
												<a class="row-link" href={channelPath(channel)}
													>{channel.peerName || 'Unnamed endpoint'}</a
												>
												<div class="finger-mobile">
													<code>{channel.peerFingerprint}</code>
												</div>
											</div>
										</div>
									</td>
									<td>
										{#if editingAliasKey === channel.peerIdentityPublicKey}
											<div class="edit-row">
												<input
													bind:this={aliasInput}
													type="text"
													maxlength="64"
													placeholder="optional"
													bind:value={aliasDraft}
													onkeydown={(event) => onAliasKeydown(channel, event)}
												/>
												<button
													type="button"
													class="icon"
													aria-label="Save alias"
													onclick={() => saveAlias(channel)}
												>
													<Icon name="check" />
												</button>
												<button
													type="button"
													class="icon"
													aria-label="Cancel"
													onclick={cancelEditAlias}
												>
													<Icon name="close" />
												</button>
											</div>
										{:else}
											<div class="display-row">
												<span class={channel.localAlias ? '' : 'muted'}
													>{channel.localAlias || '—'}</span
												>
												<button
													type="button"
													class="icon"
													aria-label="Edit alias for {channel.peerName || 'peer'}"
													onclick={() => startEditAlias(channel)}
												>
													<Icon name="pencil" />
												</button>
											</div>
										{/if}
									</td>
									<td class="hide-sm"><code>{channel.peerFingerprint}</code></td>
									<td class="muted hide-md">{channel.peerIp || 'unknown'}</td>
									<td class="actions">
										<button
											type="button"
											class="icon danger lg"
											aria-label="Delete {channel.peerName || channel.peerFingerprint}"
											onclick={() => removeChannel(channel)}
										>
											<Icon name="trash" size={36} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</main>

<dialog bind:this={resetDialog} aria-labelledby="reset-title" onclick={onResetDialogClick}>
	<h3 id="reset-title">Reset this device?</h3>
	<p>
		This deletes the name and every channel stored in this browser. You cannot undo it. Other
		devices keep their own keys.
	</p>
	<div class="row">
		<button type="button" class="ghost" onclick={closeReset} disabled={resetting}>Cancel</button>
		<button type="button" class="danger fill" onclick={confirmReset} disabled={resetting}>
			{resetting ? 'Resetting…' : 'Reset everything'}
		</button>
	</div>
</dialog>

<style>
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.reset {
		flex-shrink: 0;
		margin-top: 0.15rem;
	}

	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.count {
		font-size: 0.85rem;
	}

	.endpoint-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	.pair-card {
		margin-top: 0.85rem;
	}

	.peer-cell {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
	}

	.lifehash-thumb {
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		image-rendering: pixelated;
		border-radius: 6px;
		background: #0b0e0a;
	}

	.fact,
	.pair-tile {
		min-height: 4.6rem;
		padding: 0.9rem 1rem;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		box-sizing: border-box;
	}

	.pair-tile {
		min-height: 3.4rem;
	}

	.fact {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.45rem;
	}

	.value {
		font-size: 1.02rem;
	}

	.display-row,
	.edit-row {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.35rem;
		align-items: center;
		min-width: 0;
	}

	.display-row span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.edit-row {
		flex: 1;
	}

	.edit-row input {
		flex: 1 1 auto;
		width: auto;
		min-width: 0;
		margin: 0;
	}

	.pair-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-size: 1.05rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}

	.pair-tile:hover {
		filter: brightness(1.05);
	}

	.pair-tile.cancel {
		background: transparent;
		color: var(--danger);
		border-color: var(--danger-line);
	}

	.pair-tile.cancel strong {
		font-variant-numeric: tabular-nums;
		font-size: 1.15rem;
	}

	.note {
		margin: 0.85rem 0 0;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.table-wrap {
		overflow-x: auto;
		margin: 0 -0.25rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		vertical-align: middle;
		padding: 0.8rem 0.6rem;
		border-bottom: 1px solid var(--line);
	}

	th {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--faint);
		font-weight: 650;
	}

	td code {
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.channel-row {
		cursor: pointer;
	}

	.channel-row:hover td {
		background: rgba(16, 21, 14, 0.65);
	}

	.actions {
		width: 1%;
		text-align: right;
	}

	.finger-mobile {
		display: none;
		margin-top: 0.25rem;
	}

	@media (min-width: 480px) {
		.endpoint-grid {
			grid-template-columns: 1fr minmax(8.75rem, 10.5rem);
		}

		.pair-tile {
			min-height: 3.4rem;
			flex-direction: row;
			gap: 0.65rem;
		}
	}

	@media (min-width: 800px) {
		.endpoint-grid {
			grid-template-columns: 1fr minmax(8.75rem, 10.5rem);
		}

		.fact,
		.pair-tile {
			min-height: 5.5rem;
		}

		.pair-tile {
			grid-column: auto;
			flex-direction: column;
		}
	}

	@media (max-width: 799px) {
		.hide-md {
			display: none;
		}
	}

	@media (max-width: 639px) {
		.hide-sm {
			display: none;
		}

		.finger-mobile {
			display: block;
		}

		.top {
			align-items: center;
		}

		.lede {
			font-size: 0.92rem;
		}
	}
</style>
