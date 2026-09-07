<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		applyReadyExchange,
		channelExchangeChanged,
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
	import {
		FileAssembler,
		MAX_FILE_BYTES,
		PayloadTooLargeError,
		attachLocalFile,
		chunkCount,
		decodePayload,
		encodePayload,
		fileBlob,
		formatBytes,
		isPreviewableImage,
		newTransferId,
		readFileChunk,
		type AttachedFile,
		type FilePayload,
		type TextPayload
	} from '$lib/payload';
	import type { Channel, ChannelEvent, Endpoint } from '$lib/types';

	const MAX_MESSAGE_CHARS = 512;
	const TRANSFER_STALL_MS = 60_000;

	let endpoint = $state<Endpoint | null>(null);
	let channel = $state<Channel | null>(null);
	let loadError = $state('');
	let missing = $state(false);
	let peerReady = $state(false);
	let draft = $state('');
	let attached = $state<AttachedFile | null>(null);
	let lastReceived = $state<TextPayload | FilePayload | null>(null);
	let incoming = $state<{ name: string; received: number; size: number } | null>(null);
	let receivedAt = $state<Date | null>(null);
	let previewUrl = $state('');
	let sendNote = $state('');
	let sending = $state(false);
	let sendProgress = $state(0);
	let copied = $state(false);
	let sent = $state(false);
	let compareOpen = $state(false);
	let draggingFile = $state(false);
	let canRevealFolder = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let sentTimer: ReturnType<typeof setTimeout> | null = null;
	let stallTimer: ReturnType<typeof setTimeout> | null = null;
	let sendAbort: AbortController | null = null;
	const assembler = new FileAssembler();

	const slug = $derived(page.params.slug ?? '');
	const title = $derived(channel ? `XChan · ${channelLabel(channel)}` : 'XChan');
	const heading = $derived(channel ? channelTitle(channel) : '');
	const peerName = $derived(channel ? channelPeerName(channel) : '');
	const draftCount = $derived(draft.length);
	const canSend = $derived(peerReady && !sending && (attached !== null || draft.length > 0));
	const receivedClock = $derived(receivedAt ? formatClock(receivedAt) : '');
	const receivedText = $derived(lastReceived?.kind === 'text' ? lastReceived.text : '');
	const receivedFile = $derived(lastReceived?.kind === 'file' ? lastReceived : null);

	onMount(() => {
		canRevealFolder = typeof window.showDirectoryPicker === 'function';
		return () => {
			if (copyTimer) clearTimeout(copyTimer);
			if (sentTimer) clearTimeout(sentTimer);
			clearStall();
			sendAbort?.abort();
			revokePreview();
		};
	});

	function revokePreview() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = '';
		}
	}

	function clearStall() {
		if (stallTimer) {
			clearTimeout(stallTimer);
			stallTimer = null;
		}
	}

	function bumpStall() {
		clearStall();
		stallTimer = setTimeout(() => {
			assembler.reset();
			incoming = null;
			sendNote = 'File transfer timed out.';
			stallTimer = null;
		}, TRANSFER_STALL_MS);
	}

	function resetIncoming() {
		clearStall();
		assembler.reset();
		incoming = null;
	}

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
		lastReceived = null;
		incoming = null;
		receivedAt = null;
		sendNote = '';
		peerReady = false;
		draft = '';
		attached = null;
		copied = false;
		sent = false;
		sendProgress = 0;
		compareOpen = false;
		draggingFile = false;
		assembler.reset();
		clearStall();
		sendAbort?.abort();
		revokePreview();
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
					if (!payload.ready) {
						resetIncoming();
						return;
					}
					const current = channel;
					if (!current) return;
					let peerName = current.peerName;
					if (payload.peerNameCiphertext) {
						try {
							peerName = await decryptName(payload.peerNameCiphertext, privateKey);
						} catch {
							// ignore a name the pairing key cannot decrypt
						}
					}
					const next = applyReadyExchange(current, {
						peerName,
						peerIp: payload.peerIp,
						localIp: payload.selfIp
					});
					if (channelExchangeChanged(current, next)) {
						current.peerName = next.peerName;
						current.peerIp = next.peerIp;
						current.localIp = next.localIp;
						void putChannel({ ...current });
					}
					return;
				}
				if (payload.type === 'message') {
					try {
						const plain = await decrypt(base64ToBytes(payload.ciphertext), privateKey);
						const decoded = decodePayload(plain);
						if (decoded.kind === 'file-chunk') {
							incoming = {
								name: decoded.name,
								received: 0,
								size: decoded.fileSize
							};
							const complete = assembler.add(decoded);
							incoming = {
								name: decoded.name,
								received: complete ? decoded.fileSize : assembler.receivedBytes,
								size: decoded.fileSize
							};
							bumpStall();
							if (complete) {
								clearStall();
								incoming = null;
								acceptReceivedFile(complete);
							}
							return;
						}
						resetIncoming();
						if (decoded.kind === 'file') {
							acceptReceivedFile(decoded);
							return;
						}
						revokePreview();
						lastReceived = decoded;
						receivedAt = new Date();
						sendNote = '';
					} catch (err) {
						resetIncoming();
						sendNote =
							err instanceof PayloadTooLargeError
								? err.message
								: 'Received a message that could not be read.';
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

	async function postCiphertext(ciphertext: Uint8Array, signal: AbortSignal) {
		if (!channel) throw new Error('no channel');
		const res = await fetch('/api/channel/send', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: channel.localPublicKey,
				to: channel.peerPublicKey,
				ciphertext: bytesToBase64(ciphertext)
			}),
			signal
		});
		if (res.status === 409) {
			peerReady = false;
			throw new Error('peer is not ready');
		}
		if (res.status === 413) {
			throw new PayloadTooLargeError();
		}
		if (!res.ok) throw new Error('send failed');
	}

	async function sendFile(file: AttachedFile, peerKey: Uint8Array, signal: AbortSignal) {
		const total = chunkCount(file.size);
		const id = newTransferId();
		sendProgress = 0;
		for (let index = 0; index < total; index += 1) {
			if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
			const bytes = await readFileChunk(file.file, index);
			const ciphertext = await encrypt(
				encodePayload({
					kind: 'file-chunk',
					id,
					index,
					total,
					fileSize: file.size,
					name: file.name,
					type: file.type,
					bytes
				}),
				peerKey
			);
			await postCiphertext(ciphertext, signal);
			sendProgress = (index + 1) / total;
		}
	}

	async function sendMessage() {
		if (!channel || !peerReady || sending) return;
		const file = attached;
		const text = file ? '' : draft.slice(0, MAX_MESSAGE_CHARS);
		if (!file && !text) return;
		sending = true;
		sendNote = '';
		sendProgress = 0;
		const abort = new AbortController();
		sendAbort = abort;
		try {
			const peerKey = base64ToBytes(channel.peerPublicKey);
			if (file) {
				await sendFile(file, peerKey, abort.signal);
				attached = null;
			} else {
				await postCiphertext(
					await encrypt(encodePayload({ kind: 'text', text }), peerKey),
					abort.signal
				);
				draft = '';
			}
			sent = true;
			if (sentTimer) clearTimeout(sentTimer);
			sentTimer = setTimeout(() => {
				sent = false;
				sentTimer = null;
			}, 1500);
		} catch (err) {
			if (abort.signal.aborted) return;
			if (err instanceof PayloadTooLargeError) {
				sendNote = err.message;
			} else if (err instanceof Error && err.message === 'peer is not ready') {
				sendNote = 'Peer is not ready.';
			} else {
				sendNote = 'Send failed.';
			}
		} finally {
			if (sendAbort === abort) sendAbort = null;
			sending = false;
			sendProgress = 0;
		}
	}

	function attachFile(file: File) {
		sendNote = '';
		try {
			attached = attachLocalFile(file);
		} catch (err) {
			attached = null;
			sendNote = err instanceof PayloadTooLargeError ? err.message : 'Could not read that file.';
		}
	}

	function onFileInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void attachFile(file);
	}

	function onSendDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		draggingFile = true;
	}

	function onSendDragLeave(event: DragEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && event.currentTarget instanceof Node && event.currentTarget.contains(next)) {
			return;
		}
		draggingFile = false;
	}

	function onSendDrop(event: DragEvent) {
		event.preventDefault();
		draggingFile = false;
		const file = event.dataTransfer?.files[0];
		if (file) void attachFile(file);
	}

	async function copyReceived() {
		if (!receivedText) return;
		try {
			await navigator.clipboard.writeText(receivedText);
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

	function acceptReceivedFile(file: FilePayload) {
		revokePreview();
		if (isPreviewableImage(file.type)) {
			previewUrl = URL.createObjectURL(fileBlob(file));
		}
		lastReceived = file;
		receivedAt = new Date();
		sendNote = '';
		triggerDownload(file);
	}

	function triggerDownload(file: FilePayload) {
		const url = URL.createObjectURL(fileBlob(file));
		const link = document.createElement('a');
		link.href = url;
		link.download = file.name;
		link.rel = 'noopener';
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
	}

	async function showInFolder() {
		const picker = window.showDirectoryPicker;
		if (typeof picker !== 'function') return;
		try {
			await picker.call(window, { startIn: 'downloads' });
		} catch {
			// Picker cancelled or the downloads folder is not available.
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
			<section
				class="pane"
				class:is-drop={draggingFile}
				role="group"
				aria-label="Send"
				ondragover={onSendDragOver}
				ondragenter={onSendDragOver}
				ondragleave={onSendDragLeave}
				ondrop={onSendDrop}
			>
				<span class="kicker">Send</span>
				<input bind:this={fileInput} class="sr-only" type="file" onchange={onFileInput} />
				{#if attached}
					<div class="file-chip">
						<Icon name="file" size={18} />
						<div class="file-meta">
							<span class="file-name">{attached.name}</span>
							<span class="count">
								{#if sending}
									{formatBytes(Math.round(sendProgress * attached.size))} / {formatBytes(
										attached.size
									)}
								{:else}
									{formatBytes(attached.size)}
								{/if}
							</span>
						</div>
						<button
							type="button"
							class="icon"
							aria-label="Remove file"
							disabled={sending}
							onclick={() => (attached = null)}
						>
							<Icon name="close" size={16} />
						</button>
					</div>
					{#if sending}
						<div
							class="progress"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={Math.round(sendProgress * 100)}
						>
							<span style="width: {Math.max(sendProgress * 100, 2)}%"></span>
						</div>
					{/if}
				{:else}
					<textarea
						spellcheck="false"
						autocomplete="off"
						placeholder="Type or paste a short secret, or attach a file"
						maxlength={MAX_MESSAGE_CHARS}
						value={draft}
						oninput={onDraftInput}
						onkeydown={(event) => {
							if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								void sendMessage();
							}
						}}></textarea>
				{/if}
				<div class="pane-foot">
					<span class="count">
						{#if attached}
							{formatBytes(attached.size)} / {formatBytes(MAX_FILE_BYTES)}
						{:else}
							{draftCount} / {MAX_MESSAGE_CHARS}
						{/if}
					</span>
					<div class="send-actions">
						<button
							type="button"
							class="icon outlined"
							aria-label="Attach a file"
							disabled={sending}
							onclick={() => fileInput?.click()}
						>
							<Icon name="attach" size={18} />
						</button>
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
				<div
					class="received-body"
					class:has-file={Boolean(receivedFile || incoming)}
					aria-readonly="true"
				>
					{#if incoming}
						<div class="file-chip received-file">
							<Icon name="file" size={18} />
							<div class="file-meta">
								<span class="file-name">{incoming.name}</span>
								<span class="count"
									>{formatBytes(incoming.received)} / {formatBytes(incoming.size)}</span
								>
							</div>
						</div>
						<div
							class="progress"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={incoming.size
								? Math.round((incoming.received / incoming.size) * 100)
								: 0}
						>
							<span
								style="width: {incoming.size
									? Math.max((incoming.received / incoming.size) * 100, 2)
									: 2}%"
							></span>
						</div>
					{:else if receivedFile}
						{#if previewUrl}
							<img class="file-preview" src={previewUrl} alt="" />
						{/if}
						<div class="file-chip received-file">
							<Icon name="file" size={18} />
							<div class="file-meta">
								<span class="file-name">{receivedFile.name}</span>
								<span class="count">{formatBytes(receivedFile.bytes.byteLength)}</span>
							</div>
						</div>
					{:else if receivedText}
						<pre>{receivedText}</pre>
					{/if}
				</div>
				<div class="pane-foot">
					<span class="hint">Cleared when you leave.</span>
					{#if receivedFile}
						{#if canRevealFolder}
							<button type="button" class="compare-btn" onclick={showInFolder}>
								Show in folder
							</button>
						{/if}
					{:else if !incoming}
						<button
							type="button"
							class="ghost"
							onclick={copyReceived}
							disabled={!receivedText}
							aria-label={copied ? 'Copied' : 'Copy received message'}
						>
							<Icon name={copied ? 'check' : 'copy'} size={18} />
							{copied ? 'Copied' : 'Copy'}
						</button>
					{/if}
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
	.received-body,
	.file-chip {
		height: 120px;
		margin: 0;
		padding: 12px 14px;
		border-radius: var(--radius-inset);
		background: var(--inset);
		border: 1px solid var(--line);
		box-sizing: border-box;
	}

	.pane.is-drop {
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
	}

	.file-chip {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 120px;
		color: var(--ink);
	}

	.file-chip.received-file {
		height: auto;
		min-height: 0;
		padding: 0;
		border: 0;
		background: transparent;
		flex: none;
	}

	.file-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.file-name {
		font-size: 15px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-preview {
		max-width: 100%;
		max-height: 140px;
		object-fit: contain;
		border-radius: var(--radius-inset);
		background: var(--chip);
	}

	.send-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
	}

	.progress {
		height: 4px;
		border-radius: var(--radius-pill);
		background: var(--line);
		overflow: hidden;
		flex: none;
	}

	.progress span {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.received-body {
		overflow: auto;
		color: var(--ink);
		cursor: default;
		user-select: text;
	}

	.received-body.has-file {
		height: auto;
		min-height: 120px;
		max-height: 240px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 12px;
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

		.pane textarea,
		.file-chip {
			height: 92px;
		}

		.pane-foot .count {
			display: none;
		}

		.pane-foot button:not(.icon):not(.compare-btn) {
			width: 100%;
			height: 48px;
		}

		.send-actions {
			width: 100%;
		}

		.send-actions button:not(.icon) {
			flex: 1;
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
