export const en = {
	meta: {
		description: 'Pair two devices and send an ephemeral secret.',
		howTitle: 'How XChan works',
		howDescription:
			'How XChan pairs two devices, what the server can see, and how to check the code yourself.',
		whatsNewTitle: 'What’s new · XChan',
		whatsNewDescription: 'XChan release notes for this device and newer versions on the host.'
	},
	common: {
		cancel: 'Cancel',
		copy: 'Copy',
		copied: 'Copied',
		saved: 'Saved',
		loading: 'Loading…',
		unnamed: 'Unnamed',
		unnamedEndpoint: 'Unnamed endpoint',
		unknown: 'unknown',
		backHome: 'Back to home',
		backToPairing: 'Back to pairing',
		us: 'Us',
		them: 'Them',
		howItWorks: 'How it works',
		whatsNew: 'What’s new',
		peer: 'peer',
		optional: 'optional'
	},
	menu: {
		more: 'More',
		darkTheme: 'Dark Theme',
		language: 'Language',
		autoUpdate: 'Automatically update',
		autoUpdateHint: 'When off, this device keeps the current app until you choose to update',
		checking: 'Checking…',
		noUpdate: 'No update',
		checkForUpdate: 'Check for update',
		reset: 'Reset'
	},
	home: {
		lede: 'Pair two devices and send an ephemeral secret or file. The server only relays.',
		newVersion: 'New version',
		updateBanner:
			'A new version is on the server. This device will keep the current app until you update.',
		later: 'Later',
		update: 'Update',
		loadError: 'Could not load this device',
		resetError: 'Could not reset this device',
		thisEndpoint: 'This endpoint',
		name: 'Name',
		namePlaceholder: 'MacBook, Pixel…',
		saveName: 'Save name',
		editName: 'Edit name',
		ip: 'IP',
		pair: 'Pair',
		pairingHint: 'Press Pair on both devices within {seconds} seconds.',
		channels: 'Channels',
		empty:
			'No pairings yet. Open this app on another device and press Pair on both within {seconds} seconds. Compare LifeHash and the word grid before sending.',
		tablePeer: 'Peer',
		tableAlias: 'Alias',
		tableFingerprint: 'Fingerprint',
		tableIp: 'IP',
		tableActions: 'Actions',
		saveAlias: 'Save alias',
		editAlias: 'Edit alias for {name}',
		deleteChannel: 'Delete {name}',
		addAlias: 'Add alias',
		footerKeys: 'Channel keys live on this device only. Clearing site data destroys them.',
		resetTitle: 'Reset this device?',
		resetBody:
			'This deletes the name and every channel stored in this browser. You cannot undo it. Other devices keep their own keys.',
		resetting: 'Resetting…',
		resetEverything: 'Reset everything',
		elsewhere: 'XChan elsewhere',
		versionAria: 'Version {version}'
	},
	pair: {
		commitMismatch: 'Peer key did not match the commit. Pairing aborted.',
		pairedButFailed: 'Paired, but could not open the channel.',
		sameDevice: 'This browser is already pairing. Use another browser or device.',
		createFailed: 'Could not create a pairing key.',
		timedOut: 'Pairing timed out. Try again with both devices.',
		startFailed: 'Could not start pairing.',
		dropped: 'Pairing connection dropped.',
		rejected: 'Pairing was rejected.',
		revealFailed: 'Could not reveal pairing key.',
		busy: 'Pairing is busy.',
		networkBusy: 'This network already has pairing in progress.',
		tooManyRecent: 'Too many recent pairings.',
		tooManyAttempts: 'Too many pairing attempts.',
		tryAgainIn: 'Try again in {seconds}s.'
	},
	card: {
		copyPicture: 'Copy picture',
		pictureCopied: 'Picture copied',
		pictureSaved: 'Picture saved',
		copyWords: 'Copy words',
		wordsCopied: 'Words copied',
		share: 'Share',
		shareAria: 'Share picture and words'
	},
	channel: {
		missing: 'This channel is not on this device.',
		opening: 'Opening channel…',
		openFailed: 'Could not open this channel.',
		ready: 'Ready',
		waiting: 'Waiting',
		hintLong:
			'Check both cards against the other device before you send. Copy the picture and words if you cannot see the other screen.',
		hintShort: 'Check or copy both cards.',
		compareLong: 'Compare All 24 Words',
		compareShort: '24 Words',
		send: 'Send',
		sent: 'Sent',
		readingFile: 'Reading file…',
		removeFile: 'Remove file',
		placeholder: 'Type or paste a short secret, or attach a file',
		attachFile: 'Attach a file',
		waitNote: 'Both devices must be on this channel. Waiting for {name}.',
		received: 'Received',
		cleared: 'Cleared when you leave.',
		showInFolder: 'Show in folder',
		copyReceived: 'Copy received message',
		transferTimedOut: 'File transfer timed out.',
		unreadableMessage: 'Received a message that could not be read.',
		peerNotReady: 'Peer is not ready.',
		sendFailed: 'Send failed.',
		copyFailed: 'Copy failed.',
		fileUnreadable:
			'Could not read that file. If it is in iCloud, download it to this device first.',
		fileTooLarge: 'This file is too large (max {size}).'
	},
	how: {
		title: 'How it works',
		lede1:
			'Pair two devices and send a message or a file. A password onto a new machine, a photo from your phone to finish on a computer, a note between work and home, or something for a friend or family member.',
		lede2:
			'Keep a channel for years if you need it. Pairing a new one still takes {seconds} seconds. After you leave the page, the message is gone from this app.',
		pairTitle: 'Pair, then send',
		step1: 'Open XChan on both devices. You can install it from the browser if you want.',
		step2: 'Optionally name this device — MacBook, Pixel, and so on.',
		step3: 'Press <strong>Pair</strong> on both within {seconds} seconds.',
		step4:
			'Compare the picture and the 24-word list. <strong>Us</strong> on one screen should match <strong>Them</strong> on the other.',
		warn: 'If the picture or the words do not match, delete the channel and pair again. Do not send.',
		step5:
			'Open the same channel on both devices. When status is <strong>Ready</strong>, send text or a file (up to 50 MB). The other device saves the file automatically.',
		checkTitle: 'Why the picture and words matter',
		check1:
			'On the public site, anyone can press Pair at the same moment, and the next two devices are matched. The picture (a LifeHash) and the full 24-word list are how you confirm you connected to the device you meant — not a stranger.',
		check2:
			'If you can see both screens, compare them. If the other device is far away — yours, or someone else’s — copy the picture and the word list from the card and send them, or read the words on a call.',
		check3:
			'The picture and words are not a secret, and they are not a recovery phrase. Showing them is how the check works. They do not unlock the channel.',
		check4:
			'The three words in the channel list are only a label. The real check is the picture plus all 24 words, before you send.',
		secretTitle: 'Where your secret lives',
		onDeviceTitle: 'On this device',
		onDevice1: 'The keys for this device and its channels stay in this browser.',
		onDevice2: 'Text and files are shown only while the channel page is open.',
		onDevice3:
			'Clearing site data, resetting, or switching browsers destroys the keys. Other devices keep their own.',
		onDevice4:
			'If you install the app, you can turn off automatic updates in the menu. A banner on the home screen tells you when a new version is waiting, with a link to What’s new. This device keeps the current client until you tap Update.',
		onServerTitle: 'On the server',
		onServer1: 'The server is a relay. It passes encrypted data, then forgets it.',
		onServer2: 'It can see that two devices paired, the encrypted blobs, and IP addresses.',
		onServer3: 'It cannot read names, message text, or file contents.',
		selfHost:
			'If you want pairing that is not shared with everyone else on this site, you can run your own copy from the public repository.',
		trustTitle: 'Why you can trust this',
		trustIntro:
			'A public GitHub repository and an OpenSSF badge help people who already read source code. This page is for everyone else.',
		trustCheckTitle: 'You check the other device yourself.',
		trustCheckBody:
			'The picture and 24 words are the safety step. The site does not do this check for you.',
		trustCodeTitle: 'The code is public and has been audited.',
		trustCodeBody:
			'Anyone can read it, and anyone can audit it again — including with an AI agent. You do not have to be a programmer.',
		trustSmallTitle: 'The project is small on purpose.',
		trustSmallBody:
			'There are no accounts, no database, and no ads. With no user data sitting on a server, there is less incentive to hack it.',
		trustPinTitle: 'You can pin the client on this device.',
		trustPinBody:
			'Automatic updates are on by default. Turn them off after you install the app if you do not want a compromised host to quietly replace the copy you already have.',
		pastePrompt: 'Paste this into any coding agent:',
		prompt:
			'Review https://github.com/saldoukhov/xchan. Can the server read the messages or files I send? Can pairing connect me to a stranger if I skip comparing the picture and the 24-word list? If I do compare them on both devices, can a stranger still join?',
		sourceGithub: 'Source on GitHub',
		scorecard: 'OpenSSF Scorecard'
	},
	whatsNew: {
		title: 'What’s new',
		lede: 'This device is running <strong>{version}</strong>. Notes below load from this host, so a pinned app can read a newer release before you update.',
		hostVersion: '<strong>{version}</strong> is on the server.',
		onThisDevice: 'On this device',
		onTheServer: 'On the server'
	}
};

export type Messages = typeof en;
