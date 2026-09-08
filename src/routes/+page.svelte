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
	import {
		LOCALE_LABELS,
		LOCALES,
		applyLocale,
		fill,
		i18n,
		translateRelayMessage,
		type Locale
	} from '$lib/i18n.svelte';
	import { sanitizeName } from '$lib/name';
	import { PAIRING_SECONDS } from '$lib/pairing';
	import { APP_VERSION } from '$lib/releases';
	import { themeState, toggleTheme } from '$lib/theme.svelte';
	import {
		applyWaitingUpdate,
		checkForUpdate,
		dismissUpdate,
		toggleAutoUpdate,
		updateState
	} from '$lib/update.svelte';
	import type { Channel, Endpoint, PairEvent } from '$lib/types';

	let endpoint = $state<Endpoint | null>(null);
	let channels = $state<Channel[]>([]);
	let selfIp = $state('');
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
	let menuPanel = $state<'main' | 'language'>('main');
	let menuWrap = $state<HTMLDivElement | undefined>(undefined);
	const m = $derived(i18n.m);

	let pairAbort: AbortController | null = null;
	let pairIgnoreErrors = false;
	let pairTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		void (async () => {
			try {
				endpoint = await loadOrCreateEndpoint();
				channels = await listChannels();
			} catch (err) {
				loadError = err instanceof Error ? err.message : i18n.m.home.loadError;
			}
		})();
		void loadSelfIp();
		return () => {
			stopPairing(false);
		};
	});

	async function loadSelfIp() {
		try {
			const response = await fetch('/api/ip', {
				headers: { Accept: 'application/json' }
			});
			if (!response.ok) return;
			const body = (await response.json()) as { ip?: unknown };
			if (typeof body.ip === 'string') selfIp = body.ip.trim();
		} catch {
			// Leave unknown if the relay cannot report an address.
		}
	}

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
				pairingNote = i18n.m.pair.commitMismatch;
				return;
			}
			if (!endpoint) {
				pairing = false;
				pairingOffer = null;
				pairingNote = i18n.m.pair.pairedButFailed;
				return;
			}
			if (payload.peerIdentityPublicKey === endpoint.identityPublicKey) {
				stopPairing(true);
				pairingNote = i18n.m.pair.sameDevice;
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
				peerIp: payload.peerIp,
				localIp: selfIp
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
			pairingNote = i18n.m.pair.pairedButFailed;
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
			pairingNote = i18n.m.pair.createFailed;
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
				pairingNote = i18n.m.pair.timedOut;
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
				pairingNote = text ? translateRelayMessage(text, i18n.m) : i18n.m.pair.startFailed;
				return;
			}
			if (!response.body) {
				stopPairing(false);
				pairingNote = i18n.m.pair.dropped;
				return;
			}
			await readPairEvents(response.body, controller.signal, (payload) => {
				if (payload.type === 'waiting') return;
				if (payload.type === 'timeout') {
					stopPairing(false);
					pairingNote = i18n.m.pair.timedOut;
					return;
				}
				if (payload.type === 'cancelled') {
					stopPairing(false);
					return;
				}
				if (payload.type === 'rejected') {
					stopPairing(false);
					pairingNote =
						payload.reason === 'same-device' ? i18n.m.pair.sameDevice : i18n.m.pair.rejected;
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
							pairingNote = i18n.m.pair.revealFailed;
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
				pairingNote = i18n.m.pair.dropped;
			}
		} catch (err) {
			if (pairIgnoreErrors) return;
			if (err instanceof DOMException && err.name === 'AbortError') return;
			if (!pairing) return;
			stopPairing(false);
			pairingNote = i18n.m.pair.dropped;
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
		if (!menuOpen) menuPanel = 'main';
	}

	function closeMenu() {
		menuOpen = false;
		menuPanel = 'main';
	}

	function selectLocale(locale: Locale) {
		applyLocale(locale);
		closeMenu();
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
			loadError = err instanceof Error ? err.message : i18n.m.home.resetError;
			closeReset();
		} finally {
			resetting = false;
		}
	}
</script>

<svelte:head>
	<title>XChan</title>
	<meta name="description" content={m.meta.description} />
</svelte:head>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<main>
	<header class="top">
		<h1>
			<span class="mark">X</span>Chan
			<a
				class="ver"
				href={resolve('/whats-new')}
				aria-label={fill(m.home.versionAria, { version: APP_VERSION })}
			>
				{APP_VERSION}
			</a>
		</h1>
		<div class="top-actions">
			<a class="how-link" href={resolve('/how')} aria-label={m.common.howItWorks}>
				<Icon name="help" size={18} />
				<span class="how-text">{m.common.howItWorks}</span>
			</a>
			<div class="vdiv" aria-hidden="true"></div>
			<nav class="outlinks" aria-label={m.home.elsewhere}>
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
					aria-label={m.menu.more}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={openMenu}
				>
					<Icon name="more" size={20} />
				</button>
				{#if menuOpen}
					<div class="menu" role="menu">
						{#if menuPanel === 'language'}
							<button
								type="button"
								class="menu-item"
								role="menuitem"
								onclick={() => (menuPanel = 'main')}
							>
								<Icon name="back" size={18} />
								<span class="menu-label">{m.menu.language}</span>
							</button>
							<div class="menu-rule"></div>
							{#each LOCALES as locale (locale)}
								<button
									type="button"
									class="menu-item"
									role="menuitemradio"
									aria-checked={i18n.locale === locale}
									onclick={() => selectLocale(locale)}
								>
									<span class="menu-label">{LOCALE_LABELS[locale]}</span>
									{#if i18n.locale === locale}
										<Icon name="check" size={18} />
									{/if}
								</button>
							{/each}
						{:else}
							<button
								type="button"
								class="menu-item"
								role="menuitemcheckbox"
								aria-checked={themeState.theme === 'dark'}
								onclick={toggleTheme}
							>
								<Icon name="moon" size={18} />
								<span class="menu-label">{m.menu.darkTheme}</span>
								<span class="switch" class:on={themeState.theme === 'dark'}
									><span class="knob"></span></span
								>
							</button>
							<button
								type="button"
								class="menu-item"
								role="menuitem"
								onclick={() => (menuPanel = 'language')}
							>
								<Icon name="globe" size={18} />
								<span class="menu-label">{m.menu.language}</span>
								<span class="menu-value">{LOCALE_LABELS[i18n.locale]}</span>
							</button>
							{#if updateState.supported}
								<button
									type="button"
									class="menu-item"
									role="menuitemcheckbox"
									aria-checked={updateState.autoUpdate}
									title={m.menu.autoUpdateHint}
									onclick={() => void toggleAutoUpdate()}
								>
									<Icon name="cloud" size={18} />
									<span class="menu-label">{m.menu.autoUpdate}</span>
									<span class="switch" class:on={updateState.autoUpdate}
										><span class="knob"></span></span
									>
								</button>
								{#if !updateState.autoUpdate}
									<button
										type="button"
										class="menu-item"
										role="menuitem"
										disabled={updateState.checking}
										onclick={() => {
											void checkForUpdate().then(() => {
												if (updateState.updateAvailable) closeMenu();
											});
										}}
									>
										<Icon name="download" size={18} />
										<span class="menu-label">
											{#if updateState.checking}
												{m.menu.checking}
											{:else if updateState.checkResult === 'current'}
												{m.menu.noUpdate}
											{:else}
												{m.menu.checkForUpdate}
											{/if}
										</span>
									</button>
								{/if}
							{/if}
							<div class="menu-rule"></div>
							<button type="button" class="menu-item danger" role="menuitem" onclick={openReset}>
								<Icon name="restart" size={18} />
								{m.menu.reset}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<p class="lede">
			{m.home.lede}
		</p>
	</header>

	{#if updateState.updateAvailable}
		<section class="update-banner" role="status">
			<div class="update-copy">
				<h2>{m.home.newVersion}</h2>
				<p>
					{m.home.updateBanner}
				</p>
				<p class="update-link">
					<a href={resolve('/whats-new')}>{m.common.whatsNew}</a>
				</p>
			</div>
			<div class="row">
				<button type="button" class="ghost" onclick={dismissUpdate}>{m.home.later}</button>
				<button type="button" onclick={applyWaitingUpdate}>{m.home.update}</button>
			</div>
		</section>
	{/if}

	{#if loadError}
		<p class="error">{loadError}</p>
	{:else if !endpoint}
		<p class="muted">{m.common.loading}</p>
	{:else}
		<section class="endpoint">
			<h2>{m.home.thisEndpoint}</h2>
			<div class="endpoint-grid">
				<div class="fact">
					<span class="label">{m.home.name}</span>
					{#if editingName}
						<div class="edit-row">
							<input
								bind:this={nameInput}
								type="text"
								maxlength="64"
								placeholder={m.home.namePlaceholder}
								bind:value={nameDraft}
								onkeydown={onNameKeydown}
							/>
							<button type="button" class="icon" aria-label={m.home.saveName} onclick={saveName}>
								<Icon name="check" size={16} />
							</button>
							<button
								type="button"
								class="icon"
								aria-label={m.common.cancel}
								onclick={cancelEditName}
							>
								<Icon name="close" size={16} />
							</button>
						</div>
					{:else}
						<div class="display-row">
							<span class={endpoint.name ? 'value' : 'muted'}
								>{endpoint.name || m.common.unnamed}</span
							>
							<button
								type="button"
								class="icon"
								aria-label={m.home.editName}
								onclick={startEditName}
							>
								<Icon name="pencil" size={16} />
							</button>
						</div>
					{/if}
				</div>
				<div class="fact">
					<span class="label">{m.home.ip}</span>
					<span class={selfIp ? 'value endpoint-ip' : 'muted'} title={selfIp || undefined}
						>{selfIp || m.common.unknown}</span
					>
				</div>
				{#if pairing}
					<button type="button" class="pair-btn cancel" onclick={() => stopPairing(true)}>
						<span>{m.common.cancel}</span>
						<strong>{pairingSeconds}s</strong>
					</button>
				{:else}
					<button type="button" class="pair-btn" onclick={startPairing}>{m.home.pair}</button>
				{/if}
			</div>
			<p class="hint clock">
				<Icon name="schedule" size={16} />
				{fill(m.home.pairingHint, { seconds: PAIRING_SECONDS })}
			</p>
			{#if pairingOffer}
				<div class="pair-card">
					<IdentityCard
						title={m.common.us}
						names={[endpoint.name || m.common.unnamed]}
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
					<h2>{m.home.channels}</h2>
					<span class="count">0</span>
				</div>
				<p class="empty">
					{fill(m.home.empty, { seconds: PAIRING_SECONDS })}
				</p>
			</section>
		{:else}
			<section class="channels-desktop">
				<div class="section-head">
					<h2>{m.home.channels}</h2>
					<span class="count">{channels.length}</span>
				</div>
				<table>
					<thead>
						<tr>
							<th>{m.home.tablePeer}</th>
							<th>{m.home.tableAlias}</th>
							<th>{m.home.tableFingerprint}</th>
							<th class="hide-ip">{m.home.tableIp}</th>
							<th><span class="sr-only">{m.home.tableActions}</span></th>
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
											>{channel.peerName || m.common.unnamedEndpoint}</a
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
												placeholder={m.common.optional}
												bind:value={aliasDraft}
												onkeydown={(event) => onAliasKeydown(channel, event)}
											/>
											<button
												type="button"
												class="icon"
												aria-label={m.home.saveAlias}
												onclick={() => saveAlias(channel)}
											>
												<Icon name="check" size={16} />
											</button>
											<button
												type="button"
												class="icon"
												aria-label={m.common.cancel}
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
												aria-label={fill(m.home.editAlias, {
													name: channel.peerName || m.common.peer
												})}
												onclick={() => startEditAlias(channel)}
											>
												<Icon name="pencil" size={15} />
											</button>
										</div>
									{/if}
								</td>
								<td><code>{channel.peerFingerprint}</code></td>
								<td class="ip hide-ip">{channel.peerIp || m.common.unknown}</td>
								<td>
									<div class="actions">
										<button
											type="button"
											class="icon danger"
											aria-label={fill(m.home.deleteChannel, {
												name: channel.peerName || channel.peerFingerprint
											})}
											onclick={() => removeChannel(channel)}
										>
											<Icon name="trash" size={18} />
										</button>
										<Icon name="chevron-right" size={18} />
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<div class="channels-mobile">
				<div class="section-head">
					<h2>{m.home.channels}</h2>
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
										>{channel.peerName || m.common.unnamedEndpoint}</a
									>
									{#if editingAliasKey === channel.peerIdentityPublicKey}
										<div class="edit-row">
											<input
												bind:this={aliasInput}
												type="text"
												maxlength="64"
												placeholder={m.common.optional}
												bind:value={aliasDraft}
												onkeydown={(event) => onAliasKeydown(channel, event)}
											/>
											<button
												type="button"
												class="icon"
												aria-label={m.home.saveAlias}
												onclick={() => saveAlias(channel)}
											>
												<Icon name="check" size={16} />
											</button>
											<button
												type="button"
												class="icon"
												aria-label={m.common.cancel}
												onclick={cancelEditAlias}
											>
												<Icon name="close" size={16} />
											</button>
										</div>
									{:else}
										<button
											type="button"
											class="alias-btn"
											aria-label={fill(m.home.editAlias, {
												name: channel.peerName || m.common.peer
											})}
											onclick={() => startEditAlias(channel)}
										>
											{channel.localAlias || m.home.addAlias}
										</button>
									{/if}
								</div>
								<div class="fp-plain">{channel.peerFingerprint}</div>
								<div class="ip">{channel.peerIp || m.common.unknown}</div>
							</div>
							<div class="mobile-actions">
								<button
									type="button"
									class="icon danger"
									aria-label={fill(m.home.deleteChannel, {
										name: channel.peerName || channel.peerFingerprint
									})}
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

	<p class="foot">
		<a href={resolve('/how')}>{m.common.howItWorks}</a>
		<span aria-hidden="true"> · </span>
		<a href={resolve('/whats-new')}>{m.common.whatsNew}</a>
		<span aria-hidden="true"> · </span>
		{m.home.footerKeys}
	</p>
</main>

<dialog bind:this={resetDialog} aria-labelledby="reset-title" onclick={onResetDialogClick}>
	<h3 id="reset-title">{m.home.resetTitle}</h3>
	<p>
		{m.home.resetBody}
	</p>
	<div class="row">
		<button type="button" class="ghost" onclick={closeReset} disabled={resetting}
			>{m.common.cancel}</button
		>
		<button type="button" class="danger fill" onclick={confirmReset} disabled={resetting}>
			{resetting ? m.home.resetting : m.home.resetEverything}
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

	h1 {
		white-space: nowrap;
	}

	.ver {
		margin-left: 0.4em;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0;
		font-variant-numeric: tabular-nums;
		color: var(--ink3);
		text-decoration: none;
	}

	.ver:hover {
		color: var(--link);
	}

	.lede {
		grid-column: 1 / -1;
		max-width: none;
	}

	.update-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.update-copy {
		flex: 1 1 16rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.update-copy p {
		margin: 0;
		color: var(--ink2);
		font-size: 15px;
		line-height: 22px;
	}

	.update-link {
		margin-top: 2px;
	}

	.update-banner .row {
		flex: none;
	}

	.update-banner button {
		height: 36px;
		padding: 0 16px;
		font-size: 14px;
	}

	.top-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: none;
	}

	.how-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 12px 0 10px;
		border-radius: var(--radius-pill);
		color: var(--ink2);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		flex-shrink: 0;
	}

	.how-link:hover {
		background: var(--hover);
		color: var(--ink);
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
		width: min(300px, calc(100vw - 32px));
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

	.menu-value {
		color: var(--ink3);
		font-size: 13px;
		flex: none;
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

	.endpoint-ip {
		font-family: var(--mono);
		font-size: 16px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		width: 100%;
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
		table-layout: fixed;
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

	th:last-child,
	td:last-child {
		width: 72px;
		white-space: nowrap;
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

		.how-text {
			display: none;
		}

		.how-link {
			width: 40px;
			padding: 0;
			justify-content: center;
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
