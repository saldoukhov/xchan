const encoder = new TextEncoder();

export type SseSink = {
	send: (data: unknown) => void;
	close: () => void;
};

export function createSse(request: Request, setup: (sink: SseSink) => () => void): Response {
	let closed = false;
	let cleanup: (() => void) | undefined;
	const stream = new ReadableStream({
		start(controller) {
			const sink: SseSink = {
				send(data) {
					if (closed) return;
					try {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
					} catch {
						closed = true;
					}
				},
				close() {
					if (closed) return;
					closed = true;
					cleanup?.();
					try {
						controller.close();
					} catch {
						// already closed
					}
				}
			};
			const ping = setInterval(() => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch {
					closed = true;
				}
			}, 15000);
			const innerCleanup = setup(sink);
			let cleaned = false;
			cleanup = () => {
				if (cleaned) return;
				cleaned = true;
				clearInterval(ping);
				innerCleanup();
			};
			request.signal.addEventListener('abort', () => sink.close());
		},
		cancel() {
			closed = true;
			cleanup?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
}
