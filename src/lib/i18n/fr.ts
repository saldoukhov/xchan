import type { Messages } from './en';

export const fr: Messages = {
	meta: {
		description: 'Associez deux appareils et envoyez un secret éphémère.',
		howTitle: 'Comment fonctionne XChan',
		howDescription:
			'Comment XChan associe deux appareils, ce que le serveur peut voir, et comment vérifier le code vous-même.',
		whatsNewTitle: 'Nouveautés · XChan',
		whatsNewDescription:
			'Notes de version de XChan pour cet appareil et les versions plus récentes sur l’hôte.'
	},
	common: {
		cancel: 'Annuler',
		copy: 'Copier',
		copied: 'Copié',
		saved: 'Enregistré',
		loading: 'Chargement…',
		unnamed: 'Sans nom',
		unnamedEndpoint: 'Appareil sans nom',
		unknown: 'inconnue',
		backHome: 'Retour à l’accueil',
		backToPairing: 'Retour à l’association',
		us: 'Nous',
		them: 'Eux',
		howItWorks: 'Comment ça marche',
		whatsNew: 'Nouveautés',
		peer: 'pair',
		optional: 'facultatif'
	},
	menu: {
		more: 'Plus',
		darkTheme: 'Thème sombre',
		language: 'Langue',
		autoUpdate: 'Mettre à jour automatiquement',
		autoUpdateHint:
			'Si c’est désactivé, cet appareil conserve l’application actuelle jusqu’à ce que vous choisissiez de mettre à jour',
		checking: 'Vérification…',
		noUpdate: 'Aucune mise à jour',
		checkForUpdate: 'Rechercher une mise à jour',
		reset: 'Réinitialiser'
	},
	home: {
		lede: 'Associez deux appareils et envoyez un secret ou un fichier éphémère. Le serveur ne fait que relayer.',
		newVersion: 'Nouvelle version',
		updateBanner:
			'Une nouvelle version est sur le serveur. Cet appareil conservera l’application actuelle jusqu’à la mise à jour.',
		later: 'Plus tard',
		update: 'Mettre à jour',
		loadError: 'Impossible de charger cet appareil',
		resetError: 'Impossible de réinitialiser cet appareil',
		thisEndpoint: 'Cet appareil',
		name: 'Nom',
		namePlaceholder: 'MacBook, Pixel…',
		saveName: 'Enregistrer le nom',
		editName: 'Modifier le nom',
		ip: 'IP',
		pair: 'Associer',
		pairingHint: 'Appuyez sur Associer sur les deux appareils dans les {seconds} secondes.',
		channels: 'Canaux',
		empty:
			'Pas encore d’associations. Ouvrez cette application sur un autre appareil et appuyez sur Associer sur les deux dans les {seconds} secondes. Comparez le LifeHash et la grille de mots avant d’envoyer.',
		tablePeer: 'Pair',
		tableAlias: 'Alias',
		tableFingerprint: 'Empreinte',
		tableIp: 'IP',
		tableActions: 'Actions',
		saveAlias: 'Enregistrer l’alias',
		editAlias: 'Modifier l’alias de {name}',
		deleteChannel: 'Supprimer {name}',
		addAlias: 'Ajouter un alias',
		footerKeys:
			'Les clés des canaux restent uniquement sur cet appareil. Effacer les données du site les détruit.',
		resetTitle: 'Réinitialiser cet appareil ?',
		resetBody:
			'Cela supprime le nom et tous les canaux enregistrés dans ce navigateur. L’action est irréversible. Les autres appareils conservent leurs propres clés.',
		resetting: 'Réinitialisation…',
		resetEverything: 'Tout réinitialiser',
		elsewhere: 'XChan ailleurs',
		versionAria: 'Version {version}'
	},
	pair: {
		commitMismatch: 'La clé du pair ne correspondait pas à l’engagement. Association annulée.',
		pairedButFailed: 'Associé, mais le canal n’a pas pu être ouvert.',
		sameDevice:
			'Ce navigateur est déjà en cours d’association. Utilisez un autre navigateur ou appareil.',
		createFailed: 'Impossible de créer une clé d’association.',
		timedOut: 'L’association a expiré. Réessayez avec les deux appareils.',
		startFailed: 'Impossible de démarrer l’association.',
		dropped: 'La connexion d’association a été interrompue.',
		rejected: 'L’association a été refusée.',
		revealFailed: 'Impossible de révéler la clé d’association.',
		busy: 'L’association est occupée.',
		networkBusy: 'Ce réseau a déjà une association en cours.',
		tooManyRecent: 'Trop d’associations récentes.',
		tooManyAttempts: 'Trop de tentatives d’association.',
		tryAgainIn: 'Réessayez dans {seconds} s.'
	},
	card: {
		copyPicture: 'Copier l’image',
		pictureCopied: 'Image copiée',
		pictureSaved: 'Image enregistrée',
		copyWords: 'Copier les mots',
		wordsCopied: 'Mots copiés',
		share: 'Partager',
		shareAria: 'Partager l’image et les mots'
	},
	channel: {
		missing: 'Ce canal n’est pas sur cet appareil.',
		opening: 'Ouverture du canal…',
		openFailed: 'Impossible d’ouvrir ce canal.',
		ready: 'Prêt',
		waiting: 'En attente',
		hintLong:
			'Vérifiez les deux cartes avec l’autre appareil avant d’envoyer. Copiez l’image et les mots si vous ne voyez pas l’autre écran.',
		hintShort: 'Vérifiez ou copiez les deux cartes.',
		compareLong: 'Comparer les 24 mots',
		compareShort: '24 mots',
		send: 'Envoyer',
		sent: 'Envoyé',
		readingFile: 'Lecture du fichier…',
		removeFile: 'Retirer le fichier',
		placeholder: 'Saisissez ou collez un secret court, ou joignez un fichier',
		attachFile: 'Joindre un fichier',
		waitNote: 'Les deux appareils doivent être sur ce canal. En attente de {name}.',
		received: 'Reçu',
		cleared: 'Effacé quand vous partez.',
		showInFolder: 'Afficher dans le dossier',
		copyReceived: 'Copier le message reçu',
		transferTimedOut: 'Le transfert du fichier a expiré.',
		unreadableMessage: 'Un message reçu n’a pas pu être lu.',
		peerNotReady: 'Le pair n’est pas prêt.',
		sendFailed: 'L’envoi a échoué.',
		copyFailed: 'La copie a échoué.',
		fileUnreadable:
			'Impossible de lire ce fichier. S’il est dans iCloud, téléchargez-le d’abord sur cet appareil.',
		fileTooLarge: 'Ce fichier est trop volumineux (max. {size}).'
	},
	how: {
		title: 'Comment ça marche',
		lede1:
			'Associez deux appareils et envoyez un message ou un fichier. Un mot de passe vers une nouvelle machine, une photo du téléphone à terminer sur un ordinateur, une note entre le travail et la maison, ou quelque chose pour un ami ou un proche.',
		lede2:
			'Gardez un canal pendant des années si besoin. En associer un nouveau prend toujours {seconds} secondes. Une fois la page quittée, le message disparaît de cette application.',
		pairTitle: 'Associez, puis envoyez',
		step1:
			'Ouvrez XChan sur les deux appareils. Vous pouvez l’installer depuis le navigateur si vous le souhaitez.',
		step2: 'Nommez éventuellement cet appareil — MacBook, Pixel, etc.',
		step3: 'Appuyez sur <strong>Associer</strong> sur les deux dans les {seconds} secondes.',
		step4:
			'Comparez l’image et la liste de 24 mots. <strong>Nous</strong> sur un écran doit correspondre à <strong>Eux</strong> sur l’autre.',
		warn: 'Si l’image ou les mots ne correspondent pas, supprimez le canal et associez à nouveau. N’envoyez rien.',
		step5:
			'Ouvrez le même canal sur les deux appareils. Quand le statut est <strong>Prêt</strong>, envoyez du texte ou un fichier (jusqu’à 50 Mo). L’autre appareil enregistre le fichier automatiquement.',
		checkTitle: 'Pourquoi l’image et les mots comptent',
		check1:
			'Sur le site public, n’importe qui peut appuyer sur Associer au même moment, et les deux appareils suivants sont mis en relation. Deux appareils sur le même réseau sont d’abord associés entre eux. L’image (un LifeHash) et la liste complète de 24 mots permettent de confirmer que vous êtes connecté à l’appareil visé — pas à un inconnu.',
		check2:
			'Si vous voyez les deux écrans, comparez-les. Si l’autre appareil est loin — le vôtre, ou celui de quelqu’un d’autre — copiez l’image et la liste de mots depuis la carte et envoyez-les, ou lisez les mots au téléphone.',
		check3:
			'L’image et les mots ne sont pas un secret, ni une phrase de récupération. Les montrer, c’est ainsi que la vérification fonctionne. Ils ne déverrouillent pas le canal.',
		check4:
			'Les trois mots dans la liste des canaux ne sont qu’une étiquette. La vraie vérification, c’est l’image plus les 24 mots, avant d’envoyer.',
		secretTitle: 'Où vit votre secret',
		onDeviceTitle: 'Sur cet appareil',
		onDevice1: 'Les clés de cet appareil et de ses canaux restent dans ce navigateur.',
		onDevice2:
			'Le texte et les fichiers s’affichent seulement tant que la page du canal est ouverte.',
		onDevice3:
			'Effacer les données du site, réinitialiser ou changer de navigateur détruit les clés. Les autres appareils conservent les leurs.',
		onDevice4:
			'Si vous installez l’application, vous pouvez désactiver les mises à jour automatiques dans le menu. Une bannière sur l’écran d’accueil indique qu’une nouvelle version attend, avec un lien vers Nouveautés. Cet appareil conserve le client actuel jusqu’à ce que vous appuyiez sur Mettre à jour.',
		onServerTitle: 'Sur le serveur',
		onServer1: 'Le serveur est un relais. Il transmet des données chiffrées, puis les oublie.',
		onServer2:
			'Il peut voir que deux appareils se sont associés, les blobs chiffrés et les adresses IP.',
		onServer3: 'Il ne peut pas lire les noms, le texte des messages ni le contenu des fichiers.',
		selfHost:
			'Si vous voulez une association qui n’est pas partagée avec tout le monde sur ce site, vous pouvez exécuter votre propre copie depuis le dépôt public.',
		trustTitle: 'Pourquoi vous pouvez faire confiance',
		trustIntro:
			'Un dépôt GitHub public et un badge OpenSSF aident ceux qui lisent déjà le code source. Cette page est pour tous les autres.',
		trustCheckTitle: 'Vous vérifiez l’autre appareil vous-même.',
		trustCheckBody:
			'L’image et les 24 mots sont l’étape de sécurité. Le site ne fait pas cette vérification à votre place.',
		trustCodeTitle: 'Le code est public et a été audité.',
		trustCodeBody:
			'N’importe qui peut le lire, et n’importe qui peut l’auditer à nouveau — y compris avec un agent d’IA. Inutile d’être programmeur.',
		trustSmallTitle: 'Le projet est volontairement petit.',
		trustSmallBody:
			'Pas de comptes, pas de base de données, pas de publicités. Sans données utilisateur sur un serveur, il y a moins d’intérêt à le pirater.',
		trustPinTitle: 'Vous pouvez figer le client sur cet appareil.',
		trustPinBody:
			'Les mises à jour automatiques sont activées par défaut. Désactivez-les après avoir installé l’application si vous ne voulez pas qu’un hôte compromis remplace discrètement la copie que vous avez déjà.',
		pastePrompt: 'Collez ceci dans n’importe quel agent de code :',
		prompt:
			'Review https://github.com/saldoukhov/xchan. Can the server read the messages or files I send? Can pairing connect me to a stranger if I skip comparing the picture and the 24-word list? If I do compare them on both devices, can a stranger still join?',
		sourceGithub: 'Code source sur GitHub',
		scorecard: 'OpenSSF Scorecard'
	},
	whatsNew: {
		title: 'Nouveautés',
		lede: 'Cet appareil exécute <strong>{version}</strong>. Les notes ci-dessous se chargent depuis cet hôte, pour qu’une application figée puisse lire une version plus récente avant la mise à jour.',
		hostVersion: '<strong>{version}</strong> est sur le serveur.',
		onThisDevice: 'Sur cet appareil',
		onTheServer: 'Sur le serveur'
	}
};
