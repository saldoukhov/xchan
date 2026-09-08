<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/Icon.svelte';

	const github = 'https://github.com/saldoukhov/xchan';
	const scorecard = 'https://scorecard.dev/viewer/?uri=github.com/saldoukhov/xchan';
	const prompt =
		'Review https://github.com/saldoukhov/xchan. Can the server read the messages or files I send? Can pairing connect me to a stranger if I skip comparing the picture and the 24-word list? If I do compare them on both devices, can a stranger still join?';

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(prompt);
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
	<title>How XChan works</title>
	<meta
		name="description"
		content="How XChan pairs two devices, what the server can see, and how to check the code yourself."
	/>
</svelte:head>

<main>
	<header class="top">
		<a class="icon outlined" href={resolve('/')} aria-label="Back to home">
			<Icon name="back" size={20} />
		</a>
		<div class="intro">
			<h1>How it works</h1>
			<p class="lede">
				Pair two devices and send a message or a file. A password onto a new machine, a photo from
				your phone to finish on a computer, a note between work and home, or something for a friend
				or family member.
			</p>
			<p class="lede">
				Keep a channel for years if you need it. Pairing a new one still takes 15 seconds. After you
				leave the page, the message is gone from this app.
			</p>
		</div>
	</header>

	<section>
		<h2>Pair, then send</h2>
		<ol>
			<li>Open XChan on both devices. You can install it from the browser if you want.</li>
			<li>Optionally name this device — MacBook, Pixel, and so on.</li>
			<li>Press <strong>Pair</strong> on both within 15 seconds.</li>
			<li>
				Compare the picture and the 24-word list. <strong>Us</strong> on one screen should match
				<strong>Them</strong> on the other.
			</li>
		</ol>
		<p class="warn">
			If the picture or the words do not match, delete the channel and pair again. Do not send.
		</p>
		<ol class="cont">
			<li>
				Open the same channel on both devices. When status is <strong>Ready</strong>, send text or a
				file (up to 50 MB). The other device saves the file automatically.
			</li>
		</ol>
	</section>

	<section id="check">
		<h2>Why the picture and words matter</h2>
		<p>
			On the public site, anyone can press Pair at the same moment, and the next two devices are
			matched. The picture (a LifeHash) and the full 24-word list are how you confirm you connected
			to the device you meant — not a stranger.
		</p>
		<p>
			If you can see both screens, compare them. If the other device is far away — yours, or someone
			else’s — copy the picture and the word list from the card and send them, or read the words on
			a call.
		</p>
		<p>
			The picture and words are not a secret, and they are not a recovery phrase. Showing them is
			how the check works. They do not unlock the channel.
		</p>
		<p>
			The three words in the channel list are only a label. The real check is the picture plus all
			24 words, before you send.
		</p>
	</section>

	<section>
		<h2>Where your secret lives</h2>
		<div class="split">
			<div>
				<h3>On this device</h3>
				<ul>
					<li>The keys for this device and its channels stay in this browser.</li>
					<li>Text and files are shown only while the channel page is open.</li>
					<li>
						Clearing site data, resetting, or switching browsers destroys the keys. Other devices
						keep their own.
					</li>
					<li>
						If you install the app, you can turn off automatic updates in the menu. A banner on the
						home screen tells you when a new version is waiting. This device keeps the current
						client until you tap Update.
					</li>
				</ul>
			</div>
			<div>
				<h3>On the server</h3>
				<ul>
					<li>The server is a relay. It passes encrypted data, then forgets it.</li>
					<li>It can see that two devices paired, the encrypted blobs, and IP addresses.</li>
					<li>It cannot read names, message text, or file contents.</li>
				</ul>
			</div>
		</div>
		<p>
			If you want pairing that is not shared with everyone else on this site, you can run your own
			copy from the public repository.
		</p>
	</section>

	<section>
		<h2>Why you can trust this</h2>
		<p>
			A public GitHub repository and an OpenSSF badge help people who already read source code. This
			page is for everyone else.
		</p>
		<ul class="trust">
			<li>
				<strong>You check the other device yourself.</strong>
				The picture and 24 words are the safety step. The site does not do this check for you.
			</li>
			<li>
				<strong>The code is public and has been audited.</strong>
				Anyone can read it, and anyone can audit it again — including with an AI agent. You do not have
				to be a programmer.
			</li>
			<li>
				<strong>The project is small on purpose.</strong>
				There are no accounts, no database, and no ads. With no user data sitting on a server, there is
				less incentive to hack it.
			</li>
			<li>
				<strong>You can pin the client on this device.</strong>
				Automatic updates are on by default. Turn them off after you install the app if you do not want
				a compromised host to quietly replace the copy you already have.
			</li>
		</ul>
		<p>Paste this into any coding agent:</p>
		<div class="prompt">
			<pre>{prompt}</pre>
			<button type="button" class="ghost" onclick={copyPrompt}>
				<Icon name={copied ? 'check' : 'copy'} size={16} />
				{copied ? 'Copied' : 'Copy'}
			</button>
		</div>
		<p class="out">
			<a href={github} target="_blank" rel="noreferrer">Source on GitHub</a>
			<span aria-hidden="true">·</span>
			<a href={scorecard} target="_blank" rel="noreferrer">OpenSSF Scorecard</a>
		</p>
	</section>

	<p class="foot">
		<a href={resolve('/')}>Back to pairing</a>
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
