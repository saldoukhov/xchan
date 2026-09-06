# XChan

Web app for pairing two devices and sending an ephemeral secret (for example a password from a computer you already have to a machine you are setting up).

Each browser creates a non-exportable P-256 key pair. Pairing exchanges public keys through the server. Messages are ECIES-encrypted to the other device’s public key. The server is a relay only: it does not store keys, channels, or messages.

## How it works

1. Open the app. Your **Endpoint fingerprint** is three BIP-39 words derived from your public key.
2. Optionally name this endpoint (`MacBook`, `Pixel`, …).
3. On both devices, press **Pair** within 30 seconds. The server matches waiters FIFO and exchanges public keys, names, and IP addresses.
4. A channel appears on each device. Select it on both; when status is **ready**, send a short secret.

There is no pairing confirmation. If you were matched to the wrong machine, compare fingerprints and delete the channel.

**Self-host this.** Pairing is a single FIFO queue for everyone on that instance. Do not run a public multi-tenant deployment.

Clearing site data destroys the private key and all channels. Horizontal scale needs a shared bus; v1 is one Node process.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:5173` in two browsers (normal + incognito). Keys are origin-scoped, so two tabs in the same profile share one identity.

```sh
npm test
npm run check
npm run build
npm start
```

`npm start` serves the production build (`node build`) and uses `PORT` when set.

## Deploy on Railway

No environment variables are required. Use one replica. Railway builds from the `Dockerfile` (`npm ci`, `npm run build`, `npm start`).

There is no published Railway marketplace template, so this is not a one-click **Deploy Now** page. Deploy from GitHub:

1. [Fork this repository](https://github.com/saldoukhov/xchan/fork) if it is not already in your GitHub account. Railway only lists repos your account can access.
2. Open [railway.com/new](https://railway.com/new) and sign in. Link GitHub if Railway asks.
3. Choose **Deploy from GitHub repo**. Do not choose **Deploy a template**.
4. Select **xchan** (this repo or your fork).
5. Click **Deploy Now**. Skip **Add variables**.
6. Wait until the deployment is **Active**.
7. Open the service → **Settings → Networking → Generate Domain**.
8. Open the `*.up.railway.app` URL on both devices.

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

- The relay can see ciphertext and metadata (public keys, IPs, names), not plaintext.
- Anyone who can reach your instance can enter the pairing queue.
- v1 does not rate-limit pairing.
