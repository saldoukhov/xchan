# Product brief

Fill this in before asking Grok to scaffold or implement. Incomplete sections stay out of scope.

When this file is ready, point Grok at `@PRODUCT.md` and ask it to plan from here — do not paste the contents into the prompt.

---

## Name

- Working name:
- One-sentence description:

## Who it is for

- Primary user:
- What they are trying to do:
- First useful thing they can complete in the app:

## Shape

Pick one (or note a split, e.g. web UI + API):

- [ ] Web app
- [ ] CLI
- [ ] HTTP API / backend only
- [ ] Desktop
- [ ] Other:

## Stack

Leave a line blank if undecided; Grok should ask, not invent.

- Language:
- Framework / UI:
- Package manager:
- Database:
- Auth:
- Hosting / deploy:
- Other constraints (must use X, must not use Y):

## AI / LLM

- [ ] No LLM features in v1
- [ ] Yes — describe the feature:

If yes: provider is SpaceXAI (`XAI_API_KEY`, `https://api.x.ai/v1`). Keys stay server-side, never in the client bundle.

## v1 scope

What ships in the first runnable version (bullet list):

-

## Non-goals

Explicitly out of v1:

-

## Data and permissions

- Main entities:
- Public vs authenticated:
- Anything that must never be stored or logged:

## Verification

How we know a slice is done (commands, URLs, tests, browser flows):

-

## Open questions

Anything still blocking a plan:

-
