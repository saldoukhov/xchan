import type { Messages } from './en';

export const de: Messages = {
	meta: {
		description: 'Zwei Geräte koppeln und ein kurzlebiges Geheimnis senden.',
		howTitle: 'So funktioniert XChan',
		howDescription:
			'Wie XChan zwei Geräte koppelt, was der Server sehen kann und wie du den Code selbst prüfst.',
		whatsNewTitle: 'Neuigkeiten · XChan',
		whatsNewDescription:
			'XChan-Versionshinweise für dieses Gerät und neuere Versionen auf dem Host.'
	},
	common: {
		cancel: 'Abbrechen',
		copy: 'Kopieren',
		copied: 'Kopiert',
		saved: 'Gespeichert',
		loading: 'Laden…',
		unnamed: 'Unbenannt',
		unnamedEndpoint: 'Unbenanntes Gerät',
		unknown: 'unbekannt',
		backHome: 'Zurück zur Startseite',
		backToPairing: 'Zurück zum Koppeln',
		us: 'Wir',
		them: 'Sie',
		howItWorks: 'So funktioniert’s',
		whatsNew: 'Neuigkeiten',
		peer: 'Gegenstelle',
		optional: 'optional'
	},
	menu: {
		more: 'Mehr',
		darkTheme: 'Dunkles Design',
		language: 'Sprache',
		autoUpdate: 'Automatisch aktualisieren',
		autoUpdateHint: 'Wenn aus, behält dieses Gerät die aktuelle App, bis du selbst aktualisierst',
		checking: 'Prüfen…',
		noUpdate: 'Kein Update',
		checkForUpdate: 'Nach Update suchen',
		reset: 'Zurücksetzen'
	},
	home: {
		lede: 'Zwei Geräte koppeln und ein kurzlebiges Geheimnis oder eine Datei senden. Der Server leitet nur weiter.',
		newVersion: 'Neue Version',
		updateBanner:
			'Auf dem Server liegt eine neue Version. Dieses Gerät behält die aktuelle App, bis du aktualisierst.',
		later: 'Später',
		update: 'Aktualisieren',
		loadError: 'Dieses Gerät konnte nicht geladen werden',
		resetError: 'Dieses Gerät konnte nicht zurückgesetzt werden',
		thisEndpoint: 'Dieses Gerät',
		name: 'Name',
		namePlaceholder: 'MacBook, Pixel…',
		saveName: 'Name speichern',
		editName: 'Name bearbeiten',
		ip: 'IP',
		pair: 'Koppeln',
		pairingHint: 'Tippe auf beiden Geräten innerhalb von {seconds} Sekunden auf Koppeln.',
		channels: 'Kanäle',
		empty:
			'Noch keine Kopplungen. Öffne diese App auf einem anderen Gerät und tippe auf beiden innerhalb von {seconds} Sekunden auf Koppeln. Vergleiche LifeHash und das Wörtergitter, bevor du sendest.',
		tablePeer: 'Gegenstelle',
		tableAlias: 'Alias',
		tableFingerprint: 'Fingerabdruck',
		tableIp: 'IP',
		tableActions: 'Aktionen',
		saveAlias: 'Alias speichern',
		editAlias: 'Alias für {name} bearbeiten',
		deleteChannel: '{name} löschen',
		addAlias: 'Alias hinzufügen',
		footerKeys:
			'Kanal-Schlüssel liegen nur auf diesem Gerät. Das Löschen der Websitedaten zerstört sie.',
		resetTitle: 'Dieses Gerät zurücksetzen?',
		resetBody:
			'Das löscht den Namen und jeden in diesem Browser gespeicherten Kanal. Das lässt sich nicht rückgängig machen. Andere Geräte behalten ihre eigenen Schlüssel.',
		resetting: 'Wird zurückgesetzt…',
		resetEverything: 'Alles zurücksetzen',
		elsewhere: 'XChan anderswo',
		versionAria: 'Version {version}'
	},
	pair: {
		commitMismatch:
			'Der Schlüssel der Gegenstelle stimmte nicht mit der Zusage überein. Kopplung abgebrochen.',
		pairedButFailed: 'Gekoppelt, aber der Kanal konnte nicht geöffnet werden.',
		sameDevice:
			'Dieser Browser koppelt bereits. Nutze einen anderen Browser oder ein anderes Gerät.',
		createFailed: 'Es konnte kein Kopplungsschlüssel erzeugt werden.',
		timedOut: 'Die Kopplung ist abgelaufen. Versuche es mit beiden Geräten erneut.',
		startFailed: 'Die Kopplung konnte nicht gestartet werden.',
		dropped: 'Die Kopplungsverbindung wurde unterbrochen.',
		rejected: 'Die Kopplung wurde abgelehnt.',
		revealFailed: 'Der Kopplungsschlüssel konnte nicht offengelegt werden.',
		busy: 'Die Kopplung ist ausgelastet.',
		networkBusy: 'In diesem Netz läuft bereits eine Kopplung.',
		tooManyRecent: 'Zu viele kürzliche Kopplungen.',
		tooManyAttempts: 'Zu viele Kopplungsversuche.',
		tryAgainIn: 'Versuche es in {seconds} s erneut.'
	},
	card: {
		copyPicture: 'Bild kopieren',
		pictureCopied: 'Bild kopiert',
		pictureSaved: 'Bild gespeichert',
		copyWords: 'Wörter kopieren',
		wordsCopied: 'Wörter kopiert',
		share: 'Teilen',
		shareAria: 'Bild und Wörter teilen'
	},
	channel: {
		missing: 'Dieser Kanal ist auf diesem Gerät nicht vorhanden.',
		opening: 'Kanal wird geöffnet…',
		openFailed: 'Dieser Kanal konnte nicht geöffnet werden.',
		ready: 'Bereit',
		waiting: 'Warten',
		hintLong:
			'Prüfe beide Karten am anderen Gerät, bevor du sendest. Kopiere Bild und Wörter, wenn du den anderen Bildschirm nicht siehst.',
		hintShort: 'Beide Karten prüfen oder kopieren.',
		compareLong: 'Alle 24 Wörter vergleichen',
		compareShort: '24 Wörter',
		send: 'Senden',
		sent: 'Gesendet',
		readingFile: 'Datei wird gelesen…',
		removeFile: 'Datei entfernen',
		placeholder: 'Tippe oder füge ein kurzes Geheimnis ein, oder hänge eine Datei an',
		attachFile: 'Datei anhängen',
		waitNote: 'Beide Geräte müssen auf diesem Kanal sein. Warten auf {name}.',
		received: 'Empfangen',
		cleared: 'Wird gelöscht, wenn du gehst.',
		showInFolder: 'Im Ordner zeigen',
		copyReceived: 'Empfangene Nachricht kopieren',
		transferTimedOut: 'Die Dateiübertragung ist abgelaufen.',
		unreadableMessage: 'Eine Nachricht konnte nicht gelesen werden.',
		peerNotReady: 'Die Gegenstelle ist nicht bereit.',
		sendFailed: 'Senden fehlgeschlagen.',
		copyFailed: 'Kopieren fehlgeschlagen.',
		fileUnreadable:
			'Diese Datei konnte nicht gelesen werden. Wenn sie in iCloud liegt, lade sie zuerst auf dieses Gerät herunter.',
		fileTooLarge: 'Diese Datei ist zu groß (max. {size}).'
	},
	how: {
		title: 'So funktioniert’s',
		lede1:
			'Kopple zwei Geräte und sende eine Nachricht oder eine Datei. Ein Passwort auf eine neue Maschine, ein Foto vom Telefon zum Fertigstellen am Computer, eine Notiz zwischen Arbeit und Zuhause, oder etwas für Freunde oder Familie.',
		lede2:
			'Behalte einen Kanal jahrelang, wenn du ihn brauchst. Ein neues Koppeln dauert weiterhin {seconds} Sekunden. Wenn du die Seite verlässt, ist die Nachricht aus dieser App weg.',
		pairTitle: 'Koppeln, dann senden',
		step1:
			'Öffne XChan auf beiden Geräten. Du kannst es im Browser installieren, wenn du möchtest.',
		step2: 'Benenne dieses Gerät optional — MacBook, Pixel und so weiter.',
		step3: 'Tippe auf beiden innerhalb von {seconds} Sekunden auf <strong>Koppeln</strong>.',
		step4:
			'Vergleiche das Bild und die 24-Wörter-Liste. <strong>Wir</strong> auf dem einen Bildschirm sollte mit <strong>Sie</strong> auf dem anderen übereinstimmen.',
		warn: 'Wenn Bild oder Wörter nicht übereinstimmen, lösche den Kanal und kopple erneut. Sende nichts.',
		step5:
			'Öffne denselben Kanal auf beiden Geräten. Wenn der Status <strong>Bereit</strong> ist, sende Text oder eine Datei (bis 50 MB). Das andere Gerät speichert die Datei automatisch.',
		checkTitle: 'Warum Bild und Wörter wichtig sind',
		check1:
			'Auf der öffentlichen Seite kann jede Person im selben Moment auf Koppeln tippen, und die nächsten zwei Geräte werden verbunden. Zwei Geräte im selben Netz werden zuerst miteinander verbunden. Das Bild (ein LifeHash) und die vollständige 24-Wörter-Liste bestätigen, dass du das gemeinte Gerät erreicht hast — nicht eine fremde Person.',
		check2:
			'Wenn du beide Bildschirme siehst, vergleiche sie. Wenn das andere Gerät weit weg ist — deins oder das einer anderen Person — kopiere Bild und Wörterliste von der Karte und sende sie, oder lies die Wörter in einem Anruf vor.',
		check3:
			'Bild und Wörter sind kein Geheimnis und keine Wiederherstellungsphrase. Sie zu zeigen, ist die Prüfung. Sie entsperren den Kanal nicht.',
		check4:
			'Die drei Wörter in der Kanalliste sind nur ein Label. Die echte Prüfung ist das Bild plus alle 24 Wörter, bevor du sendest.',
		secretTitle: 'Wo dein Geheimnis lebt',
		onDeviceTitle: 'Auf diesem Gerät',
		onDevice1: 'Die Schlüssel für dieses Gerät und seine Kanäle bleiben in diesem Browser.',
		onDevice2: 'Text und Dateien werden nur angezeigt, solange die Kanalseite offen ist.',
		onDevice3:
			'Websitedaten löschen, zurücksetzen oder den Browser wechseln zerstört die Schlüssel. Andere Geräte behalten ihre eigenen.',
		onDevice4:
			'Wenn du die App installierst, kannst du automatische Updates im Menü ausschalten. Ein Banner auf dem Startbildschirm sagt dir, wenn eine neue Version wartet, mit einem Link zu Neuigkeiten. Dieses Gerät behält den aktuellen Client, bis du auf Aktualisieren tippst.',
		onServerTitle: 'Auf dem Server',
		onServer1:
			'Der Server ist ein Relais. Er leitet verschlüsselte Daten weiter und vergisst sie danach.',
		onServer2:
			'Er kann sehen, dass zwei Geräte gekoppelt wurden, die verschlüsselten Blobs und IP-Adressen.',
		onServer3: 'Er kann keine Namen, Nachrichtentexte oder Dateiinhalte lesen.',
		selfHost:
			'Wenn du eine Kopplung willst, die nicht mit allen anderen auf dieser Seite geteilt wird, kannst du eine eigene Kopie aus dem öffentlichen Repository betreiben.',
		trustTitle: 'Warum du dem vertrauen kannst',
		trustIntro:
			'Ein öffentliches GitHub-Repository und ein OpenSSF-Badge helfen Menschen, die schon Quellcode lesen. Diese Seite ist für alle anderen.',
		trustCheckTitle: 'Du prüfst das andere Gerät selbst.',
		trustCheckBody:
			'Bild und 24 Wörter sind der Sicherheitsschritt. Die Seite macht diese Prüfung nicht für dich.',
		trustCodeTitle: 'Der Code ist öffentlich und wurde geprüft.',
		trustCodeBody:
			'Jede Person kann ihn lesen, und jede Person kann ihn erneut prüfen — auch mit einem KI-Agenten. Du musst kein Programmierer sein.',
		trustSmallTitle: 'Das Projekt ist absichtlich klein.',
		trustSmallBody:
			'Es gibt keine Konten, keine Datenbank und keine Werbung. Ohne Nutzerdaten auf einem Server gibt es weniger Anreiz, ihn anzugreifen.',
		trustPinTitle: 'Du kannst den Client auf diesem Gerät festnageln.',
		trustPinBody:
			'Automatische Updates sind standardmäßig an. Schalte sie nach der Installation aus, wenn du nicht willst, dass ein kompromittierter Host die Kopie, die du schon hast, still ersetzt.',
		pastePrompt: 'Füge das in einen beliebigen Coding-Agenten ein:',
		prompt:
			'Review https://github.com/saldoukhov/xchan. Can the server read the messages or files I send? Can pairing connect me to a stranger if I skip comparing the picture and the 24-word list? If I do compare them on both devices, can a stranger still join?',
		sourceGithub: 'Quellcode auf GitHub',
		scorecard: 'OpenSSF Scorecard'
	},
	whatsNew: {
		title: 'Neuigkeiten',
		lede: 'Dieses Gerät läuft mit <strong>{version}</strong>. Die Hinweise unten laden von diesem Host, damit eine festgenagelte App eine neuere Version lesen kann, bevor du aktualisierst.',
		hostVersion: '<strong>{version}</strong> liegt auf dem Server.',
		onThisDevice: 'Auf diesem Gerät',
		onTheServer: 'Auf dem Server'
	}
};
