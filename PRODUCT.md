## Name

- Working name: XChan
- One-sentence description: web application for connecting pairs of machines and sending ephemeral messages via these channels.

## Who it is for

- Primary user: anybody
- What they are trying to do: send an ephemeral secret message between two devices
- First useful thing they can complete in the app: send a password from already authenteticated computer to a new machine they are setting up.

## Shape

Pick one (or note a split, e.g. web UI + API):

- [x] Web app
- [ ] CLI
- [ ] HTTP API / backend only
- [ ] Desktop
- [ ] Other:

## Stack

Leave a line blank if undecided; Grok should ask, not invent.

- Language: Typescript
- Framework / UI: Svelte
- Package manager: npm
- Database: none
- Auth: none
- Hosting / deploy: Railway
- Other constraints (must use X, must not use Y): Users should be able to deploy their own on Railway from the README.md

## AI / LLM

- [x] No LLM features in v1
- [ ] Yes — describe the feature:

If yes: provider is SpaceXAI (`XAI_API_KEY`, `https://api.x.ai/v1`). Keys stay server-side, never in the client bundle.

## v1 scope

What ships in the first runnable version (bullet list):

- When app opens for the first time, it creates a key pair (WebCrypto CryptoKeys) with non exportable private key. From the public key, it generates a "fingerprint" of 3 BIP-39 words. See https://github.com/saldoukhov/r2p for fingerprint implementation, but it is not necessary to follow it exactly. The fingerprint is displayed as "Endpoint fingerprint".
- App allows user to name the endpoint (f.e. "MacBook", "Pixel" etc)
- App has a "Pair" button which puts it in the pairing mode. When in pairing mode, the server pairs devices by exchanging the public keys (when signalling the pairing mode, the device sends the public key up). Successful pairing toggles off the pairing mode for a device. User also can cancel the pairing on its own. While in pairing mode, the device is listening for the confirmation from the server using SSE. Pairing only lasts limited time, up to 30 seconds. When pairing is complete, a "channel" appers in the UI and is automatically selected for sending. There is no confirmation for pairing, but user will be able to see if it was paired to wrong machine and delete the pairing.
- Server pairs devices using FIFO method, eliminating each pair from the queue.
- Server throttles pairing in memory: per-IP join window, per-IP successful-match window, at most two concurrent waiters per IP, and a global queue cap. Exhausted match budget rejects further joins (does not enqueue). IPv6 is keyed by /64. Unknown IPs share a stricter bucket. Limits reset when the process restarts.
- In the channel list, the user sees the fingerprints, ip addresses and endpoint names. User can also add own partner endpoint name, in which case they will see both.
- When a channel is selected for sending, device is listening to SSE from the server. As such, to send information both devices should be in ready to send mode. When a channel is selected for sending, the user should see the other party status. At other times, there is no SSE, so it is unknown when your channels come ready to send.
- Information sent to another party is encrypted with the other party public key using ecies encyption schema. For the reference, see Keeper Secrets Manager JS SDK.
- Server does not store any information, it is just a relay between parties.

## Non-goals

Explicitly out of v1:

- CAPTCHA, accounts, or pairing identity beyond in-memory IP throttles

## Data and permissions

- Main entities: none
- Public vs authenticated: none
- Anything that must never be stored or logged: none

## Verification

How we know a slice is done (commands, URLs, tests, browser flows):

- Developer will test manually

## Open questions

Anything still blocking a plan:

- none
