# XChan

Web app for pairing two devices and sending an ephemeral secret — a password, a short note, or a small file — from a computer you already have to a machine you are setting up.

**Live at [xchan.dev](https://xchan.dev).** It is a PWA — install it from the browser on each device.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/xchan)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/saldoukhov/xchan/badge)](https://scorecard.dev/viewer/?uri=github.com/saldoukhov/xchan)

Each pairing mints a non-exportable P-256 key pair. Clients commit to `SHA-256(pairing public key || identity public key)` first, then reveal the keys after a FIFO match. Messages, files, and endpoint names are ECIES-encrypted to the peer’s pairing public key. The server is a relay only: it does not store keys, channels, or messages. Files up to 50 MiB are sent as encrypted chunks; each relayed ciphertext is capped at 1 MiB.

## How it works

1. Optionally name this endpoint (`MacBook`, `Pixel`, …).
2. On both devices, press **Pair** within 15 seconds. The server matches commits FIFO; devices then reveal public keys and check them against the commits.
3. While pairing, compare **Us** on one screen with **Them** on the other: LifeHash picture plus the 24-word grid.
4. A channel appears. The list shows a LifeHash thumbnail and the first three words. Select the channel on both devices; when status is **ready**, send a short secret or attach a file (up to 50 MB). The other device saves the file automatically.

If the other device is far away, copy the picture and the 24 words from a card and send them. If the cards do not match, delete the channel and pair again.

The in-app **How it works** page (`/how`) is the same story for people who do not read GitHub: what to compare, what the relay can see, and a prompt you can paste into an agent to audit the source.

The hosted instance at [xchan.dev](https://xchan.dev) uses one FIFO pairing queue for everyone on that host. **Self-host this** if you want a private queue.

Clearing site data destroys pairing keys and all channels. Horizontal scale needs a shared bus; v1 is one Node process.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:5173` in two browsers (normal + incognito). Channel keys are origin-scoped, so two tabs in the same profile share stored channels.

```sh
npm test
npm run check
npm run build
npm start
```

`npm start` serves the production build (`node build`) and uses `PORT` when set. It also sets `BODY_SIZE_LIMIT=2M` so file chunks are accepted (`adapter-node` defaults to 512kb).

## Deploy on Railway

No environment variables are required. Use one replica.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/xchan)

Railway builds from the `Dockerfile` (`npm ci`, `npm run build`, `npm start`). After deploy, open the `*.up.railway.app` URL on both devices.

The app reads the leftmost public address in `X-Forwarded-For` (Railway’s edge CDN can append extra hops; SvelteKit’s default `XFF_DEPTH=1` would show the CDN). The `Dockerfile` still sets `ADDRESS_HEADER=X-Forwarded-For` as a fallback.

### Railway CLI

```sh
npm i -g @railway/cli
railway login
railway init
railway up
```

Then generate a public domain in the service settings.

## Security notes

- The relay can see ciphertext, pairing commits, public keys after reveal, and IPs — not names, message plaintext, or file contents.
- Compare LifeHash and the 24-word grid across both devices before sending. The three-word list label is not the security check.
- Anyone who can reach your instance can enter the pairing queue, subject to in-memory IP throttles (joins and successful matches), two concurrent waiters per IP, and a global queue cap. Limits reset when the process restarts.
- Automatic updates are on by default. Turn them off in the menu after installing the PWA if you want this device to keep its current client until you choose to update. The home screen shows a banner when a new version is waiting.
