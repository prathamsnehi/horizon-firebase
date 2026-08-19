# Agent context

Read this first. It is the orientation an agent needs before touching this repo;
the human-facing docs live in [../developer/](../developer/) and are deliberately
thinner.

## What this repo is

The Firebase backend for **Horizon**, an app that generates real-world "quests"
pushing a user just past their comfort zone. The backend's whole job is: take a
user profile, produce 3 curated quests (or 1 from a freeform prompt), each tied to
a real place with a photo.

**The client is not in this repo.** It is a separate iOS/SwiftData app. There is
no web frontend — the React app that used to live in `frontend/` was deleted, and
`hosting/` now serves a static coming-soon page.

## Where things are

| Path | What |
|---|---|
| `functions/` | The entire backend. This is the work. |
| `hosting/` | One static HTML page. Not an app. |
| `firestore/` | Rules (deny-all) + indexes |
| `extensions/` | Delete-user-data extension config |
| `docs/api/` | The wire contract — source of truth for request/response shapes |
| `docs/agent/` | This directory: deep technical context |
| `docs/developer/` | Short, practical, human-facing |
| `docs/frontend/` | iOS client data models |

## Start here, in order

1. [architecture.md](./architecture.md) — layering, request flow, rate limiting,
   LLM routing, fault tolerance
2. [../api/api-contracts.md](../api/api-contracts.md) — the contract
3. [observability.md](./observability.md) — what gets recorded, and the anonymity
   invariant
4. [backlog.md](./backlog.md) — what's deliberately not built yet
5. [v2/](./v2/) — a deferred self-hosting blueprint. **Design of record, not
   work in progress.** Do not start building it.

## Running things

`node` is installed via nvm and may not be on a non-interactive `PATH`. If a
command reports `node: command not found`:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
```

Node 22 is the project's version (`engines`, CI, and the Cloud Functions runtime
all agree).

```bash
cd functions
npx jest          # 116 tests, ~1s — run these, they are fast and meaningful
npx tsc --noEmit  # typecheck
npx tsc           # real build (what predeploy runs)
```

Dependencies are managed with **yarn** (`yarn.lock` is what CI installs from),
though `npx` works fine for running the local toolchain.

## Invariants — do not break these

**`generation_samples` is anonymous.** No uid, no profile hash, no
`additionalContext`, no rendered LLM prompts, and nothing written at all for a
moderated prompt. Anything user-supplied goes through `observability/sanitize.ts`
before reaching a span. This is the property that lets the corpus run in
production; treat it as load-bearing.

**Identity is `request.auth.uid`.** Never a payload field. There is no `deviceId`
any more.

**The Maps key never reaches a client.** Photos are fetched server-side and
embedded as base64.

**Validation happens before spend.** Any new callable validates its payload
before reserving a rate-limit slot or calling a model.

**Secrets live in Secret Manager**, declared with `defineSecret` and attached to
the functions that need them. There is no `.env` in this project.

## Repo conventions

- **One branch: `main`.** A long-lived `test` branch used to carry observability
  separately; that divergence has been collapsed and should not be recreated.
  Environment-specific behaviour belongs in config, not in a branch.
- Comments explain *why*, not what. The existing code is dense with rationale —
  match that register rather than narrating syntax.
- Tests favour pure functions (`rateMath`, `evaluateReservation`, `sanitize`,
  `validation`) over mock-heavy integration tests.
