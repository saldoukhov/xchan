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
	import { sanitizeName } from '$lib/name';
	import { PAIRING_SECONDS } from '$lib/pairing';
	import { themeState, toggleTheme } from '$lib/theme.svelte';
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
	let menuOpen = $state(false);
	let menuWrap = $state<HTMLDivElement | undefined>(undefined);

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
		endpoint = await saveEndpointName(endpoint, sanitizeName(nameDraft));
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
				peerName: existing?.peerName ?? '',
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
		const url = `/api/pair/events?commit=${encodeURIComponent(offer.commit)}&identityPublicKey=${encodeURIComponent(offer.identityPublicKey)}`;
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

	function openMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (!menuOpen) return;
		const target = event.target;
		if (target instanceof Node && menuWrap?.contains(target)) return;
		closeMenu();
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			event.preventDefault();
			closeMenu();
		}
	}

	function openReset() {
		closeMenu();
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

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<main>
	<header class="top">
		<h1><span class="mark">X</span>Chan</h1>
		<div class="top-actions">
			<nav class="outlinks" aria-label="XChan elsewhere">
				<a
					class="icon"
					href="https://github.com/saldoukhov/xchan"
					target="_blank"
					rel="noreferrer"
					aria-label="GitHub"
				>
					<Icon name="github" size={19} />
				</a>
				<a
					class="icon"
					href="https://x.com/saldoukhov"
					target="_blank"
					rel="noreferrer"
					aria-label="X"
				>
					<Icon name="x" size={17} />
				</a>
			</nav>
			<div class="vdiv" aria-hidden="true"></div>
			<div class="menu-wrap" bind:this={menuWrap}>
				<button
					type="button"
					class="icon outlined"
					aria-label="More"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={openMenu}
				>
					<Icon name="more" size={20} />
				</button>
				{#if menuOpen}
					<div class="menu" role="menu">
						<button
							type="button"
							class="menu-item"
							role="menuitemcheckbox"
							aria-checked={themeState.theme === 'dark'}
							onclick={toggleTheme}
						>
							<Icon name="moon" size={18} />
							<span class="menu-label">Dark Theme</span>
							<span class="switch" class:on={themeState.theme === 'dark'}
								><span class="knob"></span></span
							>
						</button>
						<div class="menu-rule"></div>
						<button type="button" class="menu-item danger" role="menuitem" onclick={openReset}>
							<Icon name="restart" size={18} />
							Reset
						</button>
					</div>
				{/if}
			</div>
		</div>
		<p class="lede">Pair two devices and send an ephemeral secret. The server only relays.</p>
	</header>

	{#if loadError}
		<p class="error">{loadError}</p>
	{:else if !endpoint}
		<p class="muted">Loading…</p>
	{:else}
		<section class="endpoint">
			<h2>This endpoint</h2>
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
								<Icon name="check" size={16} />
							</button>
							<button type="button" class="icon" aria-label="Cancel" onclick={cancelEditName}>
								<Icon name="close" size={16} />
							</button>
						</div>
					{:else}
						<div class="display-row">
							<span class={endpoint.name ? 'value' : 'muted'}>{endpoint.name || 'Unnamed'}</span>
							<button type="button" class="icon" aria-label="Edit name" onclick={startEditName}>
								<Icon name="pencil" size={16} />
							</button>
						</div>
					{/if}
				</div>
				{#if pairing}
					<button type="button" class="pair-btn cancel" onclick={() => stopPairing(true)}>
						<span>Cancel</span>
						<strong>{pairingSeconds}s</strong>
					</button>
				{:else}
					<button type="button" class="pair-btn" onclick={startPairing}>Pair</button>
				{/if}
			</div>
			<p class="hint clock">
				<Icon name="schedule" size={16} />
				Press Pair on both devices within 15 seconds.
			</p>
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

		{#if channels.length === 0}
			<section class="channels-empty">
				<div class="section-head">
					<h2>Channels</h2>
					<span class="count">0</span>
				</div>
				<p class="empty">
					No pairings yet. Open this app on another device and press Pair on both within 15 seconds.
					Compare LifeHash and the word grid before sending.
				</p>
			</section>
		{:else}
			<section class="channels-desktop">
				<div class="section-head">
					<h2>Channels</h2>
					<span class="count">{channels.length}</span>
				</div>
				<table>
					<thead>
						<tr>
							<th>Peer</th>
							<th>Alias</th>
							<th>Fingerprint</th>
							<th class="hide-ip">IP</th>
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
											width="36"
											height="36"
											alt=""
										/>
										<a class="row-link" href={channelPath(channel)}
											>{channel.peerName || 'Unnamed endpoint'}</a
										>
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
												<Icon name="check" size={16} />
											</button>
											<button
												type="button"
												class="icon"
												aria-label="Cancel"
												onclick={cancelEditAlias}
											>
												<Icon name="close" size={16} />
											</button>
										</div>
									{:else}
										<div class="display-row">
											<span class={channel.localAlias ? 'alias' : 'muted'}
												>{channel.localAlias || '—'}</span
											>
											<button
												type="button"
												class="icon"
												aria-label="Edit alias for {channel.peerName || 'peer'}"
												onclick={() => startEditAlias(channel)}
											>
												<Icon name="pencil" size={15} />
											</button>
										</div>
									{/if}
								</td>
								<td><code>{channel.peerFingerprint}</code></td>
								<td class="ip hide-ip">{channel.peerIp || 'unknown'}</td>
								<td class="actions">
									<button
										type="button"
										class="icon danger"
										aria-label="Delete {channel.peerName || channel.peerFingerprint}"
										onclick={() => removeChannel(channel)}
									>
										<Icon name="trash" size={18} />
									</button>
									<Icon name="chevron-right" size={18} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<div class="channels-mobile">
				<div class="section-head">
					<h2>Channels</h2>
					<span class="count">{channels.length}</span>
				</div>
				<div class="mobile-list">
					{#each channels as channel (channel.peerIdentityPublicKey)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="mobile-card"
							onclick={(event) => onChannelRowClick(channel, event)}
							onauxclick={(event) => onChannelRowAuxClick(channel, event)}
						>
							<img
								class="lifehash-thumb lg"
								src={channel.peerLifeHash}
								width="48"
								height="48"
								alt=""
							/>
							<div class="mobile-meta">
								<div class="mobile-names">
									<a class="row-link" href={channelPath(channel)}
										>{channel.peerName || 'Unnamed endpoint'}</a
									>
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
												<Icon name="check" size={16} />
											</button>
											<button
												type="button"
												class="icon"
												aria-label="Cancel"
												onclick={cancelEditAlias}
											>
												<Icon name="close" size={16} />
											</button>
										</div>
									{:else}
										<button
											type="button"
											class="alias-btn"
											aria-label="Edit alias for {channel.peerName || 'peer'}"
											onclick={() => startEditAlias(channel)}
										>
											{channel.localAlias || 'Add alias'}
										</button>
									{/if}
								</div>
								<div class="fp-plain">{channel.peerFingerprint}</div>
								<div class="ip">{channel.peerIp || 'unknown'}</div>
							</div>
							<div class="mobile-actions">
								<button
									type="button"
									class="icon danger"
									aria-label="Delete {channel.peerName || channel.peerFingerprint}"
									onclick={() => removeChannel(channel)}
								>
									<Icon name="trash" size={18} />
								</button>
								<Icon name="chevron-right" size={20} />
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<p class="foot">Channel keys live on this device only. Clearing site data destroys them.</p>
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
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: flex-start;
		column-gap: 24px;
		row-gap: 6px;
	}

	.lede {
		grid-column: 1 / -1;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: none;
	}

	.outlinks {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.vdiv {
		width: 1px;
		height: 22px;
		background: var(--line);
		margin: 0 6px;
	}

	.menu-wrap {
		position: relative;
	}

	.menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		width: 216px;
		padding: 6px;
		background: var(--menu);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
		z-index: 20;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: auto;
		padding: 9px 10px;
		border-radius: var(--radius-inset);
		background: transparent;
		color: var(--ink);
		font-size: 15px;
		font-weight: 400;
		justify-content: flex-start;
		width: 100%;
		border: 0;
	}

	.menu-item:hover:not(:disabled) {
		filter: none;
		background: var(--hover);
	}

	.menu-item.danger {
		color: var(--danger);
	}

	.menu-item.danger:hover:not(:disabled) {
		background: var(--danger-soft);
	}

	.menu-label {
		flex: 1;
		text-align: left;
	}

	.menu-rule {
		height: 1px;
		background: var(--line);
		margin: 6px 4px;
	}

	.switch {
		width: 34px;
		height: 20px;
		border-radius: var(--radius-pill);
		flex: none;
		display: block;
		padding: 2px;
		box-sizing: border-box;
		background: var(--switch-off);
		transition: background 160ms ease-in-out;
	}

	.switch.on {
		background: var(--accent);
	}

	.knob {
		width: 16px;
		height: 16px;
		border-radius: var(--radius-pill);
		display: block;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		transform: translateX(0);
		transition: transform 160ms ease-in-out;
	}

	.switch.on .knob {
		transform: translateX(14px);
	}

	.endpoint {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.endpoint-grid {
		display: flex;
		align-items: stretch;
		gap: 16px;
	}

	.fact {
		flex: 1;
		min-width: 0;
		background: var(--inset);
		border: 1px solid var(--line);
		border-radius: var(--radius-inset);
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		box-sizing: border-box;
	}

	.value {
		font-size: 18px;
		font-weight: 500;
	}

	.display-row,
	.edit-row {
		display: flex;
		flex-wrap: nowrap;
		gap: 8px;
		align-items: center;
		min-width: 0;
	}

	.display-row span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.display-row button.icon,
	.edit-row button.icon,
	.actions button.icon,
	.mobile-actions button.icon {
		width: 32px;
		height: 32px;
		min-width: 32px;
	}

	.pair-card :global(.card) {
		background: var(--inset);
	}

	.pair-card :global(.grid) {
		column-gap: 14px;
	}

	.edit-row {
		flex: 1;
	}

	.edit-row input {
		flex: 1 1 auto;
		width: auto;
		min-width: 0;
		margin: 0;
		padding: 6px 10px;
		height: 32px;
	}

	.pair-btn {
		min-width: 168px;
		padding: 0 32px;
		height: auto;
		border-radius: var(--radius-pill);
		font-size: 16px;
		font-weight: 500;
	}

	.pair-btn.cancel {
		background: transparent;
		color: var(--danger);
		border: 1px solid var(--danger);
		flex-direction: column;
		gap: 2px;
		height: auto;
		min-height: 48px;
	}

	.pair-btn.cancel:hover:not(:disabled) {
		filter: none;
		background: var(--danger-soft);
	}

	.pair-btn.cancel strong {
		font-variant-numeric: tabular-nums;
		font-size: 15px;
		font-weight: 500;
	}

	.clock {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pair-card {
		margin-top: 0;
	}

	.note {
		margin: 0;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 16px;
	}

	.count {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink3);
	}

	.empty {
		margin: 0;
		color: var(--ink2);
		font-size: 15px;
		line-height: 22px;
	}

	.channels-desktop {
		padding: 20px 24px 8px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		vertical-align: middle;
		padding: 14px 8px;
		border-bottom: 1px solid var(--line);
	}

	th {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink3);
		padding: 0 8px 10px;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.channel-row {
		cursor: pointer;
	}

	.channel-row:hover td {
		background: var(--hover);
	}

	.peer-cell {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.lifehash-thumb {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		image-rendering: pixelated;
		border-radius: var(--radius-inset);
		background: var(--inset);
	}

	.lifehash-thumb.lg {
		width: 48px;
		height: 48px;
	}

	.row-link {
		font-size: 15px;
		font-weight: 500;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-link:hover {
		color: var(--ink);
		text-decoration: none;
	}

	.alias {
		font-size: 15px;
		color: var(--ink2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ip {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink3);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 6px;
		color: var(--ink3);
	}

	.channels-mobile {
		display: none;
	}

	.mobile-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.mobile-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 14px;
		display: flex;
		gap: 14px;
		align-items: center;
		cursor: pointer;
	}

	.mobile-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.mobile-names {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.alias-btn {
		height: auto;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
		color: var(--ink3);
		font-size: 14px;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.alias-btn:hover:not(:disabled) {
		filter: none;
		color: var(--ink);
	}

	.fp-plain {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink2);
	}

	.mobile-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		color: var(--ink3);
		flex: none;
	}

	@media (max-width: 900px) {
		.hide-ip {
			display: none;
		}
	}

	@media (max-width: 720px) {
		.top {
			align-items: center;
			column-gap: 12px;
		}

		.lede {
			margin-top: 0;
		}

		.vdiv {
			display: none;
		}

		.endpoint-grid {
			flex-direction: column;
			gap: 14px;
		}

		.fact {
			padding: 11px 14px;
		}

		.value {
			font-size: 17px;
		}

		.pair-btn {
			min-width: 0;
			width: 100%;
			height: 48px;
			padding: 0;
		}

		.channels-desktop {
			display: none;
		}

		.channels-mobile {
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.section-head {
			padding-bottom: 0;
		}
	}
</style>
