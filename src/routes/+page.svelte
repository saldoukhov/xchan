<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { channelSlug } from '$lib/channel';
	import { base64ToBytes } from '$lib/crypto/bytes';
	import { fingerprintFromBytes } from '$lib/crypto/fingerprint';
	import { loadOrCreateEndpoint, resetAndCreateEndpoint, saveEndpointName } from '$lib/crypto/keys';
	import { deleteChannel, listChannels, putChannel } from '$lib/db';
	import Icon from '$lib/Icon.svelte';
	import type { Channel, Endpoint, PairEvent } from '$lib/types';

	let endpoint = $state<Endpoint | null>(null);
	let channels = $state<Channel[]>([]);
	let loadError = $state('');
	let pairing = $state(false);
	let pairingSeconds = $state(30);
	let pairingNote = $state('');
	let resetting = $state(false);

	let editingName = $state(false);
	let nameDraft = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	let editingAliasKey = $state<string | null>(null);
	let aliasDraft = $state('');
	let aliasInput = $state<HTMLInputElement | undefined>(undefined);

	let resetDialog = $state<HTMLDialogElement | undefined>(undefined);

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
		editingAliasKey = channel.peerPublicKey;
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
		channels = channels.map((c) => (c.peerPublicKey === channel.peerPublicKey ? updated : c));
		cancelEditAlias();
	}

	function closePairSource() {
		if (pairTimer) {
			clearInterval(pairTimer);
			pairTimer = null;
		}
		if (pairSource) {
			pairSource.onerror = null;
			pairSource.onmessage = null;
			pairSource.close();
			pairSource = null;
		}
	}

	function stopPairing(notifyServer: boolean) {
		pairing = false;
		closePairSource();
		if (notifyServer && endpoint) {
			void fetch('/api/pair/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ publicKey: endpoint.publicKey })
			});
		}
	}

	async function finishPairing(payload: Extract<PairEvent, { type: 'paired' }>) {
		try {
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
			await goto(resolve('/channel/[slug]', { slug: channelSlug(channel.peerFingerprint) }));
		} catch {
			pairing = false;
			pairingNote = 'Paired, but could not open the channel.';
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
		pairSource.onmessage = (event) => {
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
				pairingNote = '';
				closePairSource();
				void finishPairing(payload);
			}
		};
		pairSource.onerror = () => {
			if (!pairing) return;
			stopPairing(false);
			pairingNote = 'Pairing connection dropped.';
		};
	}

	async function removeChannel(channel: Channel) {
		await deleteChannel(channel.peerPublicKey);
		channels = channels.filter((c) => c.peerPublicKey !== channel.peerPublicKey);
		if (editingAliasKey === channel.peerPublicKey) {
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
		<p class="muted">Creating a device key…</p>
	{:else}
		<section class="endpoint">
			<div class="section-head">
				<h2>This endpoint</h2>
			</div>
			<div class="endpoint-grid">
				<div class="fact">
					<span class="label">Fingerprint</span>
					<code>{endpoint.fingerprint}</code>
				</div>
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
					No pairings yet. Open this app on another device and press Pair on both.
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
							{#each channels as channel (channel.peerPublicKey)}
								<tr
									class="channel-row"
									onclick={(event) => onChannelRowClick(channel, event)}
									onauxclick={(event) => onChannelRowAuxClick(channel, event)}
								>
									<td>
										<a class="row-link" href={channelPath(channel)}
											>{channel.peerName || 'Unnamed endpoint'}</a
										>
										<div class="finger-mobile">
											<code>{channel.peerFingerprint}</code>
										</div>
									</td>
									<td>
										{#if editingAliasKey === channel.peerPublicKey}
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
		This deletes the key in this browser and every channel stored here. You cannot undo it. Other
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

	.fact code,
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
			grid-template-columns: 1fr 1fr;
		}

		.pair-tile {
			grid-column: 1 / -1;
			min-height: 3.4rem;
			flex-direction: row;
			gap: 0.65rem;
		}
	}

	@media (min-width: 800px) {
		.endpoint-grid {
			grid-template-columns: 1fr 1fr minmax(8.75rem, 10.5rem);
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
