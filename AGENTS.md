# xchan

Product decisions live in `PRODUCT.md`. Treat that file as source of truth.

## Stack

- TypeScript, SvelteKit, npm
- `@sveltejs/adapter-node` (Railway)
- No database, no auth, no LLM features
- Identity keys and channels live in the browser (IndexedDB)
- Server is an in-memory pairing queue + SSE relay (`src/lib/server/relay.ts`)

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run check`
- Production: `npm run build` then `npm start` (`node build`, honors `PORT`)

## Conventions

- Do not invent stack, scope, or features that contradict `PRODUCT.md`
- Never push to GitHub
- Never commit secrets or put API keys in client code
- Do not log public keys, ciphertext, or message bodies
- Do not persist messages, files, or pairings on the server

## Releases

When shipping a user-visible change:

- Bump `package.json` (and `package-lock.json`) version
- Set `APP_VERSION` in `src/lib/releases.ts` to the same value
- Add a new object at the **top** of `RELEASES` (newest first) with `version`, `date` (YYYY-MM-DD), and `notes`
- Notes appear on `/whats-new` and `/whats-new.json`. Pinned clients fetch the JSON from the host.
