import { base } from '$app/paths';
import { dev } from '$app/environment';
import { loadAutoUpdate, saveAutoUpdate } from './db';
import { SW_MESSAGE, shouldApplyWaitingWorker, type SwMessage } from './update';

export const updateState = $state({
	autoUpdate: true,
	updateAvailable: false,
	supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
	checking: false,
	checkResult: '' as '' | 'current'
});

let registration: ServiceWorkerRegistration | null = null;
let started = false;
let bound = false;
let hadControllerAtStart = false;
let checkNoteTimer: ReturnType<typeof setTimeout> | null = null;

function swUrl() {
	return `${base}/service-worker.js`;
}

function postToWorkers(message: SwMessage) {
	registration?.installing?.postMessage(message);
	registration?.waiting?.postMessage(message);
	registration?.active?.postMessage(message);
	navigator.serviceWorker.controller?.postMessage(message);
}

function onInstalled(target: ServiceWorkerRegistration) {
	const waiting = target.waiting;
	if (!waiting) return;
	const hasController = Boolean(navigator.serviceWorker.controller);
	if (shouldApplyWaitingWorker({ autoUpdate: updateState.autoUpdate, hasController })) {
		waiting.postMessage({ type: SW_MESSAGE.skipWaiting } satisfies SwMessage);
		return;
	}
	if (hasController) updateState.updateAvailable = true;
}

function bindRegistration(target: ServiceWorkerRegistration) {
	registration = target;
	if (bound) {
		if (target.waiting) onInstalled(target);
		return;
	}
	bound = true;
	target.addEventListener('updatefound', () => {
		const worker = target.installing;
		if (!worker) return;
		worker.addEventListener('statechange', () => {
			if (worker.state === 'installed') onInstalled(target);
		});
	});
	if (target.waiting) onInstalled(target);
}

export async function initUpdates() {
	if (started) return;
	started = true;
	if (!updateState.supported) return;

	try {
		updateState.autoUpdate = await loadAutoUpdate();
	} catch {
		updateState.autoUpdate = true;
	}

	hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (hadControllerAtStart) location.reload();
	});

	try {
		const existing = await navigator.serviceWorker.getRegistration();
		if (!existing) {
			bindRegistration(
				await navigator.serviceWorker.register(swUrl(), dev ? { type: 'module' } : undefined)
			);
			return;
		}
		bindRegistration(existing);
		await existing.update();
	} catch {
		// Private mode or a blocked worker should not break pairing.
	}
}

export async function setAutoUpdate(enabled: boolean) {
	updateState.autoUpdate = enabled;
	if (!enabled) updateState.checkResult = '';
	try {
		await saveAutoUpdate(enabled);
	} catch {
		// Preference stays in memory for this session.
	}
	postToWorkers({ type: SW_MESSAGE.setAutoUpdate, value: enabled });
	if (!enabled) return;
	updateState.updateAvailable = false;
	const target = registration ?? (await navigator.serviceWorker.getRegistration());
	if (!target) return;
	try {
		await target.update();
	} catch {
		// Same as a failed background check.
	}
	onInstalled(target);
}

export async function toggleAutoUpdate() {
	await setAutoUpdate(!updateState.autoUpdate);
}

export function dismissUpdate() {
	updateState.updateAvailable = false;
}

export function applyWaitingUpdate() {
	const waiting = registration?.waiting;
	if (!waiting) {
		updateState.updateAvailable = false;
		return;
	}
	waiting.postMessage({ type: SW_MESSAGE.skipWaiting } satisfies SwMessage);
}

export async function checkForUpdate(): Promise<void> {
	if (!updateState.supported || updateState.checking) return;
	updateState.checking = true;
	updateState.checkResult = '';
	if (checkNoteTimer) {
		clearTimeout(checkNoteTimer);
		checkNoteTimer = null;
	}
	try {
		const target =
			registration ??
			(await navigator.serviceWorker.getRegistration()) ??
			(await navigator.serviceWorker.register(swUrl(), dev ? { type: 'module' } : undefined));
		bindRegistration(target);
		await target.update();
		if (target.installing) {
			await waitForState(target.installing, 'installed', 'redundant');
		}
		if (target.waiting && navigator.serviceWorker.controller) {
			updateState.updateAvailable = true;
			return;
		}
		updateState.checkResult = 'current';
		checkNoteTimer = setTimeout(() => {
			updateState.checkResult = '';
			checkNoteTimer = null;
		}, 2000);
	} catch {
		updateState.checkResult = 'current';
	} finally {
		updateState.checking = false;
	}
}

function waitForState(worker: ServiceWorker, ...states: ServiceWorkerState[]) {
	if (states.includes(worker.state)) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			worker.removeEventListener('statechange', onChange);
			resolve();
		}, 8000);
		const onChange = () => {
			if (!states.includes(worker.state)) return;
			clearTimeout(timer);
			worker.removeEventListener('statechange', onChange);
			resolve();
		};
		worker.addEventListener('statechange', onChange);
	});
}
