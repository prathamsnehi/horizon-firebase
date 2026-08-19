# Horizon — developer guide

The Firebase backend for Horizon. Start here.

> **In flight:** the `/admin` dashboard is built but not yet deployed. The
> remaining steps are in [../HANDOFF.md](../HANDOFF.md).

**What it does:** takes a user's profile → returns 3 quests tied to real places
nearby, each with a photo. Or 1 quest from a sentence they typed. That's it.

The iOS app is a separate repo. `hosting/` is a small React app: the
coming-soon page at `/`, and an admin dashboard at `/admin`.

## Everyday commands

```bash
cd functions
npx jest            # run tests (~1s)
npx tsc --noEmit    # typecheck

cd hosting
npm run dev         # the site at localhost:5174
npm test            # dashboard maths
npm run build

firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

If `node: command not found`, your shell didn't load nvm:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
```

## Where things live

| I want to… | Go to |
|---|---|
| Change what a quest looks like on the wire | [../api/api-contracts.md](../api/api-contracts.md) |
| Change the AI prompts | `functions/src/utils/prompts.ts` |
| Add or rotate a key | [secrets.md](./secrets.md) |
| Watch the app's health | the dashboard at `/admin` — see [admin-dashboard.md](./admin-dashboard.md) |
| See what the app records | [../agent/observability.md](../agent/observability.md) |
| Know what's left before launch | [launch-checklist.md](./launch-checklist.md) |
| Remember why the product works this way | [concept.md](./concept.md) |

## How a quest gets made

```
profile ──► Scout AI ──► "coffee bar with counter seating in Saint Paul"
                              │
                        Google Places ──► a real place + photo
                              │
                        Writer AI ──► the quest, tied to that place
```

If Places can't find enough real spots, the gap is filled with quests that don't
need a location. A batch never fails outright.

Each user gets **1 curated batch + 1 described quest per 24h**, enforced
server-side on their Firebase Auth uid.

## Deploying

Pushing to `main` auto-deploys via GitHub Actions:

- changes under `hosting/` → hosting deploy
- changes under `functions/` → functions deploy

Both go to the **`horizon-sidequests`** project. There is no staging — a push to
`main` is a production deploy.

## Going deeper

Detailed technical docs live in [../agent/](../agent/) — architecture, the
observability data inventory, the backlog, and a deferred v2 blueprint. They're
written for AI agents working in this codebase, but they're the reference if you
need the full picture.
