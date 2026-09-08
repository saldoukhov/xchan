## Name

- Working name: XChan
- One-sentence description: web application for connecting pairs of machines and sending ephemeral messages via these channels.

## Who it is for

- Primary user: anybody
- What they are trying to do: send an ephemeral secret (text or a file) between two devices
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

- App allows user to name the endpoint (f.e. "MacBook", "Pixel" etc). Each browser keeps a long-lived identity key so the same two machines reuse one channel.
- App has a "Pair" button. Pairing mints a fresh non-exportable P-256 key. The client commits to SHA-256(pairing public key || identity public key). The server FIFO-matches two commits, then both clients reveal pairing and identity public keys. Each client checks the reveal against the commit. Pairing lasts 15 seconds, enforced by the client (ignore a late success). User can cancel. While pairing, the device shows its own LifeHash (detailed, 64×64) and a 6×4 grid of 24 BIP-39 words (full 2048-word list of SHA-256 of the pairing public key). After pair, a channel stores that pairing keypair plus the peer keys. Pairing the same two machines again updates that channel.
- Compare LifeHash and the word grid with the other device before sending. The channel list shows a LifeHash thumbnail and the first three of the 24 words.
- Server pairs devices using FIFO method, eliminating each pair from the queue.
- Server throttles pairing in memory: per-IP join window, per-IP successful-match window, at most two concurrent waiters per IP, and a global queue cap. Exhausted match budget rejects further joins (does not enqueue). IPv6 is keyed by /64. Unknown IPs share a stricter bucket. Limits reset when the process restarts.
- In the channel list, the user sees LifeHash thumbnails, the first three fingerprint words, ip addresses and endpoint names. User can also add own partner endpoint name, in which case they will see both. The channel page shows both Us and Them identity cards (LifeHash + 24-word grid). Each card can copy the picture and the 24 words so they can be sent over messenger or email when the devices are not in the same place.
- When a channel is selected for sending, device is listening to SSE from the server. As such, to send information both devices should be in ready to send mode. When a channel is selected for sending, the user should see the other party status. At other times, there is no SSE, so it is unknown when your channels come ready to send. The endpoint name is ECIES-encrypted to the peer pairing public key on that SSE join; the server relays ciphertext only. When both ends are ready, the server includes each side’s connection IP in the status event; each client stores both IPs on the channel.
- User can send a short text secret (up to 512 characters) or a file up to 50 MiB (photos, short videos). Files are split into ECIES-encrypted chunks and relayed over SSE like text; the server does not store chunks. Each relayed ciphertext is capped at 1 MiB. The receiver saves the file automatically and can preview common raster images. A Show in folder link is offered when the browser can open a downloads-folder picker. Text and files are shown only while the channel page is open.
- Information sent to another party (messages, files, and endpoint names) is encrypted with the other party public key using ecies encyption schema. For the reference, see Keeper Secrets Manager JS SDK.
- Server does not store any information, it is just a relay between parties.
- App has a How it works page in plain language: pairing steps, why to compare LifeHash and the 24-word grid, what the relay can and cannot see, and that the public source has been audited and can be audited again with an agent.
- After installing the PWA, the user can turn off automatic updates. A new client then waits for a manual Update instead of replacing the running app on its own. Default remains automatic.

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
