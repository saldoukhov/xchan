import type { Messages } from './en';

export const es: Messages = {
	meta: {
		description: 'Empareja dos dispositivos y envía un secreto efímero.',
		howTitle: 'Cómo funciona XChan',
		howDescription:
			'Cómo XChan empareja dos dispositivos, qué puede ver el servidor y cómo comprobar el código tú mismo.',
		whatsNewTitle: 'Novedades · XChan',
		whatsNewDescription:
			'Notas de las versiones de XChan para este dispositivo y las versiones más nuevas en el servidor.'
	},
	common: {
		cancel: 'Cancelar',
		copy: 'Copiar',
		copied: 'Copiado',
		saved: 'Guardado',
		loading: 'Cargando…',
		unnamed: 'Sin nombre',
		unnamedEndpoint: 'Dispositivo sin nombre',
		unknown: 'desconocida',
		backHome: 'Volver al inicio',
		backToPairing: 'Volver al emparejamiento',
		us: 'Nosotros',
		them: 'Ellos',
		howItWorks: 'Cómo funciona',
		whatsNew: 'Novedades',
		peer: 'par',
		optional: 'opcional'
	},
	menu: {
		more: 'Más',
		darkTheme: 'Tema oscuro',
		language: 'Idioma',
		autoUpdate: 'Actualizar automáticamente',
		autoUpdateHint:
			'Si está desactivado, este dispositivo conserva la aplicación actual hasta que elijas actualizar',
		checking: 'Comprobando…',
		noUpdate: 'Sin actualización',
		checkForUpdate: 'Buscar actualización',
		reset: 'Restablecer'
	},
	home: {
		lede: 'Empareja dos dispositivos y envía un secreto o un archivo efímero. El servidor solo retransmite.',
		newVersion: 'Nueva versión',
		updateBanner:
			'Hay una versión nueva en el servidor. Este dispositivo conservará la aplicación actual hasta que actualices.',
		later: 'Más tarde',
		update: 'Actualizar',
		loadError: 'No se pudo cargar este dispositivo',
		resetError: 'No se pudo restablecer este dispositivo',
		thisEndpoint: 'Este dispositivo',
		name: 'Nombre',
		namePlaceholder: 'MacBook, Pixel…',
		saveName: 'Guardar nombre',
		editName: 'Editar nombre',
		ip: 'IP',
		pair: 'Emparejar',
		pairingHint: 'Pulsa Emparejar en ambos dispositivos en un plazo de {seconds} segundos.',
		channels: 'Canales',
		empty:
			'Aún no hay emparejamientos. Abre esta aplicación en otro dispositivo y pulsa Emparejar en ambos en un plazo de {seconds} segundos. Compara el LifeHash y la cuadrícula de palabras antes de enviar.',
		tablePeer: 'Par',
		tableAlias: 'Alias',
		tableFingerprint: 'Huella',
		tableIp: 'IP',
		tableActions: 'Acciones',
		saveAlias: 'Guardar alias',
		editAlias: 'Editar alias de {name}',
		deleteChannel: 'Eliminar {name}',
		addAlias: 'Añadir alias',
		footerKeys:
			'Las claves de los canales viven solo en este dispositivo. Borrar los datos del sitio las destruye.',
		resetTitle: '¿Restablecer este dispositivo?',
		resetBody:
			'Esto elimina el nombre y todos los canales guardados en este navegador. No se puede deshacer. Los demás dispositivos conservan sus propias claves.',
		resetting: 'Restableciendo…',
		resetEverything: 'Restablecer todo',
		elsewhere: 'XChan en otros sitios',
		versionAria: 'Versión {version}'
	},
	pair: {
		commitMismatch: 'La clave del par no coincidió con el compromiso. Emparejamiento cancelado.',
		pairedButFailed: 'Emparejado, pero no se pudo abrir el canal.',
		sameDevice: 'Este navegador ya está emparejando. Usa otro navegador o dispositivo.',
		createFailed: 'No se pudo crear una clave de emparejamiento.',
		timedOut: 'El emparejamiento expiró. Inténtalo de nuevo con ambos dispositivos.',
		startFailed: 'No se pudo iniciar el emparejamiento.',
		dropped: 'Se perdió la conexión de emparejamiento.',
		rejected: 'El emparejamiento fue rechazado.',
		revealFailed: 'No se pudo revelar la clave de emparejamiento.',
		busy: 'El emparejamiento está ocupado.',
		networkBusy: 'Esta red ya tiene un emparejamiento en curso.',
		tooManyRecent: 'Demasiados emparejamientos recientes.',
		tooManyAttempts: 'Demasiados intentos de emparejamiento.',
		tryAgainIn: 'Inténtalo de nuevo en {seconds} s.'
	},
	card: {
		copyPicture: 'Copiar imagen',
		pictureCopied: 'Imagen copiada',
		pictureSaved: 'Imagen guardada',
		copyWords: 'Copiar palabras',
		wordsCopied: 'Palabras copiadas',
		share: 'Compartir',
		shareAria: 'Compartir imagen y palabras'
	},
	channel: {
		missing: 'Este canal no está en este dispositivo.',
		opening: 'Abriendo el canal…',
		openFailed: 'No se pudo abrir este canal.',
		ready: 'Listo',
		waiting: 'Esperando',
		hintLong:
			'Compara ambas tarjetas con el otro dispositivo antes de enviar. Copia la imagen y las palabras si no puedes ver la otra pantalla.',
		hintShort: 'Comprueba o copia ambas tarjetas.',
		compareLong: 'Comparar las 24 palabras',
		compareShort: '24 palabras',
		send: 'Enviar',
		sent: 'Enviado',
		readingFile: 'Leyendo el archivo…',
		removeFile: 'Quitar archivo',
		placeholder: 'Escribe o pega un secreto corto, o adjunta un archivo',
		attachFile: 'Adjuntar un archivo',
		waitNote: 'Ambos dispositivos deben estar en este canal. Esperando a {name}.',
		received: 'Recibido',
		cleared: 'Se borra al salir.',
		showInFolder: 'Mostrar en carpeta',
		copyReceived: 'Copiar el mensaje recibido',
		transferTimedOut: 'La transferencia del archivo expiró.',
		unreadableMessage: 'Se recibió un mensaje que no se pudo leer.',
		peerNotReady: 'El par no está listo.',
		sendFailed: 'El envío falló.',
		copyFailed: 'No se pudo copiar.',
		fileUnreadable:
			'No se pudo leer ese archivo. Si está en iCloud, descárgalo primero a este dispositivo.',
		fileTooLarge: 'Este archivo es demasiado grande (máx. {size}).'
	},
	how: {
		title: 'Cómo funciona',
		lede1:
			'Empareja dos dispositivos y envía un mensaje o un archivo. Una contraseña a una máquina nueva, una foto del teléfono para terminarla en un ordenador, una nota entre el trabajo y casa, o algo para un amigo o un familiar.',
		lede2:
			'Conserva un canal durante años si lo necesitas. Emparejar uno nuevo sigue tardando {seconds} segundos. Al salir de la página, el mensaje desaparece de esta aplicación.',
		pairTitle: 'Empareja, luego envía',
		step1: 'Abre XChan en ambos dispositivos. Puedes instalarlo desde el navegador si quieres.',
		step2: 'Si quieres, nombra este dispositivo: MacBook, Pixel, etc.',
		step3: 'Pulsa <strong>Emparejar</strong> en ambos en un plazo de {seconds} segundos.',
		step4:
			'Compara la imagen y la lista de 24 palabras. <strong>Nosotros</strong> en una pantalla debe coincidir con <strong>Ellos</strong> en la otra.',
		warn: 'Si la imagen o las palabras no coinciden, elimina el canal y vuelve a emparejar. No envíes nada.',
		step5:
			'Abre el mismo canal en ambos dispositivos. Cuando el estado sea <strong>Listo</strong>, envía texto o un archivo (hasta 50 MB). El otro dispositivo guarda el archivo automáticamente.',
		checkTitle: 'Por qué importan la imagen y las palabras',
		check1:
			'En el sitio público, cualquiera puede pulsar Emparejar al mismo tiempo, y se emparejan los dos siguientes dispositivos. La imagen (un LifeHash) y la lista completa de 24 palabras son cómo confirmas que te conectaste al dispositivo que querías, no a un desconocido.',
		check2:
			'Si puedes ver ambas pantallas, compáralas. Si el otro dispositivo está lejos —el tuyo o el de otra persona—, copia la imagen y la lista de palabras de la tarjeta y envíalas, o lee las palabras en una llamada.',
		check3:
			'La imagen y las palabras no son un secreto, ni una frase de recuperación. Mostrarlas es cómo funciona la comprobación. No desbloquean el canal.',
		check4:
			'Las tres palabras de la lista de canales son solo una etiqueta. La comprobación real es la imagen más las 24 palabras, antes de enviar.',
		secretTitle: 'Dónde vive tu secreto',
		onDeviceTitle: 'En este dispositivo',
		onDevice1: 'Las claves de este dispositivo y sus canales permanecen en este navegador.',
		onDevice2:
			'El texto y los archivos se muestran solo mientras la página del canal está abierta.',
		onDevice3:
			'Borrar los datos del sitio, restablecer o cambiar de navegador destruye las claves. Los demás dispositivos conservan las suyas.',
		onDevice4:
			'Si instalas la aplicación, puedes desactivar las actualizaciones automáticas en el menú. Un aviso en la pantalla de inicio te indica cuando hay una versión nueva en espera, con un enlace a Novedades. Este dispositivo conserva el cliente actual hasta que pulses Actualizar.',
		onServerTitle: 'En el servidor',
		onServer1: 'El servidor es un relé. Pasa datos cifrados y luego los olvida.',
		onServer2:
			'Puede ver que dos dispositivos se emparejaron, los blobs cifrados y las direcciones IP.',
		onServer3: 'No puede leer nombres, el texto de los mensajes ni el contenido de los archivos.',
		selfHost:
			'Si quieres un emparejamiento que no se comparta con todos los demás en este sitio, puedes ejecutar tu propia copia desde el repositorio público.',
		trustTitle: 'Por qué puedes confiar en esto',
		trustIntro:
			'Un repositorio público de GitHub y una insignia OpenSSF ayudan a quienes ya leen código fuente. Esta página es para todos los demás.',
		trustCheckTitle: 'Tú compruebas el otro dispositivo.',
		trustCheckBody:
			'La imagen y las 24 palabras son el paso de seguridad. El sitio no hace esta comprobación por ti.',
		trustCodeTitle: 'El código es público y ha sido auditado.',
		trustCodeBody:
			'Cualquiera puede leerlo, y cualquiera puede auditarlo de nuevo, también con un agente de IA. No hace falta ser programador.',
		trustSmallTitle: 'El proyecto es pequeño a propósito.',
		trustSmallBody:
			'No hay cuentas, ni base de datos, ni anuncios. Sin datos de usuarios en un servidor, hay menos incentivo para atacarlo.',
		trustPinTitle: 'Puedes fijar el cliente en este dispositivo.',
		trustPinBody:
			'Las actualizaciones automáticas están activadas por defecto. Desactívalas después de instalar la aplicación si no quieres que un servidor comprometido reemplace en silencio la copia que ya tienes.',
		pastePrompt: 'Pega esto en cualquier agente de código:',
		prompt:
			'Review https://github.com/saldoukhov/xchan. Can the server read the messages or files I send? Can pairing connect me to a stranger if I skip comparing the picture and the 24-word list? If I do compare them on both devices, can a stranger still join?',
		sourceGithub: 'Código en GitHub',
		scorecard: 'OpenSSF Scorecard'
	},
	whatsNew: {
		title: 'Novedades',
		lede: 'Este dispositivo ejecuta <strong>{version}</strong>. Las notas de abajo se cargan desde este servidor, para que una aplicación fijada pueda leer una versión más nueva antes de actualizar.',
		hostVersion: '<strong>{version}</strong> está en el servidor.',
		onThisDevice: 'En este dispositivo',
		onTheServer: 'En el servidor'
	}
};
