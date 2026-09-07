# XChan

Web app for pairing two devices and sending an ephemeral secret (for example a password from a computer you already have to a machine you are setting up).

**Live at [xchan.dev](https://xchan.dev).** It is a PWA — install it from the browser on each device.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/xchan)

Each pairing mints a non-exportable P-256 key pair. Clients commit to `SHA-256(public key)` first, then reveal the keys after a FIFO match. Messages are ECIES-encrypted to the peer’s pairing public key. The server is a relay only: it does not store keys, channels, or messages.

## How it works

1. Optionally name this endpoint (`MacBook`, `Pixel`, …).
2. On both devices, press **Pair** within 15 seconds. The server matches commits FIFO; devices then reveal public keys and check them against the commits.
3. While pairing, compare **Us** on one screen with **Them** on the other: LifeHash picture plus the 24-word grid.
4. A channel appears. The list shows a LifeHash thumbnail and the first three words. Select the channel on both devices; when status is **ready**, send a short secret.

If the cards do not match, delete the channel and pair again.

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

`npm start` serves the production build (`node build`) and uses `PORT` when set.

## Deploy on Railway

No environment variables are required. Use one replica.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/xchan)

Railway builds from the `Dockerfile` (`npm ci`, `npm run build`, `npm start`). After deploy, open the `*.up.railway.app` URL on both devices.

If the client IP shown in channels is the proxy instead of the peer, set these on the service (the `Dockerfile` already sets them):

```
ADDRESS_HEADER=X-Forwarded-For
XFF_DEPTH=1
```

### Railway CLI

```sh
npm i -g @railway/cli
railway login
railway init
railway up
```

Then generate a public domain in the service settings.

## Security notes

- The relay can see ciphertext, pairing commits, public keys after reveal, IPs, and names — not plaintext.
- Compare LifeHash and the 24-word grid across both devices before sending. The three-word list label is not the security check.
- Anyone who can reach your instance can enter the pairing queue, subject to in-memory IP throttles (joins and successful matches), two concurrent waiters per IP, and a global queue cap. Limits reset when the process restarts.
