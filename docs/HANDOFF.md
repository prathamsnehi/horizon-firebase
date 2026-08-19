# Handoff — finishing the admin dashboard

**Status: code is written, tested, and uncommitted. Nothing is deployed.**

This is a temporary runbook. Delete it once the checklist at the bottom is done.

If you are an agent picking this up cold, read
[agent/README.md](./agent/README.md) first — it has the repo layout, the
invariants, and the environment gotchas.

---

## What was just built

`hosting/` used to be a single static HTML page. It is now a small Vite + React +
TypeScript app:

- **`/`** — the same coming-soon page. The markup is inlined in `index.html`, so
  it paints on the first byte; React renders identical markup over it.
- **`/admin`** — a dashboard over the anonymous `generation_samples` collection:
  health metrics (latency percentiles per stage, Maps resolution rate, cache-hit
  rate, generic-fallback rate, LLM failover rate, volume over time) plus a
  filterable log viewer whose detail view draws each sample's spans as a
  waterfall with the provider failover chain.

The admin route is lazy-loaded, so a visitor to `/` never downloads Firebase.

**Access model:** Google sign-in, then the Firestore rules check that a document
exists at `admins/{uid}`. Reads go straight from the browser via the Firestore
**client** SDK — there is no Admin SDK in the browser and no service account
anywhere near it. `functions/scripts/get-trace.js` was deleted; the dashboard
replaces it.

## Current state

- `main` is pushed and clean. **All the work below is uncommitted** in the
  working tree.
- The `test` branch still exists locally and on origin. It is **stale** — its
  work is merged into `main`, and its last commit predates the move of the
  exempt-uid list from `.env` to Secret Manager. It should be deleted.
- Nothing has been deployed: not the hosting app, not the Firestore rules, not
  the indexes.

---

## Do these in order

### 1. Check whether the last CI deploy actually succeeded

`main` was pushed while `RATE_LIMIT_EXEMPT_UIDS` had just become a
`defineSecret`. **A declared secret that has never been created makes
`firebase deploy` fail**, and a `--non-interactive` CI run cannot answer the
prompt to create it.

Check the Actions tab for the most recent "Deploy Firebase Functions on merge"
run. If it failed on a missing secret:

```bash
npx firebase-tools@14 functions:secrets:set RATE_LIMIT_EXEMPT_UIDS --project horizon-sidequests
# paste a uid, or a single space to create it empty
```

Then re-run the workflow. See [developer/secrets.md](./developer/secrets.md).

### 2. Get the uid and grant yourself access

A Firebase uid does not exist until that account signs in, so there is nothing
to look up in advance. **It will not be `wjydGLbytkdSoo76h3nI9i19N4z1`** — that
one came from Sign in with Apple on the iOS app; signing in with Google creates a
separate account.

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
cd hosting
npm install
npm run dev            # http://localhost:5174/admin
```

Sign in with Google. The "Not authorized" screen shows your uid with a **Copy**
button — that is by design, and it works even before the rules are deployed.

Then create the document. Firebase console is the no-tooling path:

> Firestore Database → Start collection → `admins` → Document ID = *your uid* →
> add any field (e.g. `note: "me"`) → Save

Or, once `gcloud auth application-default login` has been run:

```bash
cd functions
node scripts/add-admin.js <uid> "me"
node scripts/add-admin.js --list
node scripts/add-admin.js --remove <uid>
```

### 3. Deploy the rules and indexes

Until this runs, the live rules are still deny-all and the dashboard will sign
you in and then show nothing. It fails safe, but it does not work.

```bash
npx firebase-tools@14 login
npx firebase-tools@14 deploy --only firestore:rules,firestore:indexes --project horizon-sidequests
```

The indexes are two composites on `generation_samples` — `(type, startedAt desc)`
and `(outcome, startedAt desc)` — for the log viewer's filters. Firestore builds
them asynchronously; filtering may error for a minute or two with a message
naming the missing index.

### 4. Verify it end to end

- `/` looks unchanged, and DevTools → Network shows **no firebase chunk** loaded.
- `/admin` while signed out → sign-in button.
- Signed in without an `admins/` doc → not-authorized, uid shown.
- With the doc → dashboard renders real numbers.
- Logs → filter by type and by outcome → open one → the waterfall draws.

### 5. Restrict the API key — do this before the repo is public

The Firebase web config in `hosting/src/lib/firebase.ts` is **safe to commit**;
Google's position is that these values identify a project and authorise nothing.
Security comes from Auth plus the Firestore rules.

**But that key is a Google Cloud API key**, and if it has no *API restrictions* it
can call any API enabled on the project — including **Places API**, which is
billed. That is the real exposure of a public repo, and it is the part worth
fixing.

Google Cloud console → **APIs & Services → Credentials** → open the key
`AIzaSyC_rlal_3vwUhCeB70wyrNFHmSaB5Nnmfw` (usually named "Browser key (auto
created by Firebase)").

**Application restrictions → Websites.** Add:

```
https://horizon-sidequests.web.app/*
https://horizon-sidequests.firebaseapp.com/*
http://localhost:5174/*
```

(plus any custom domain later). Omitting localhost breaks local development.

**API restrictions → Restrict key.** Allow only what a Firebase web app needs:

- Identity Toolkit API — sign-in
- Token Service API — token refresh
- Cloud Firestore API — the dashboard's reads
- Firebase Installations API

**Do not include Places API or any Maps API.** If Places is currently selectable
on this key, that is exactly the hole being closed.

**Then check the Places key separately.** `PLACES_API_KEY` in Secret Manager
should be a *different* key, restricted to Places API only, with no website
restriction (it is called server-side). Confirm the two keys are not the same
value.

After saving, sign out and back in at `/admin` — restricting the wrong API
breaks auth, and you want to find that out immediately.

---

## Committing

The user handles git; do not commit or push without being asked. When asked:

- **One sentence per commit.** No multi-paragraph bodies.
- **No `Co-Authored-By` trailer.**

## Environment gotchas

- **`node` is not on a non-interactive `PATH`.** If a command reports
  `node: command not found`:
  `export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"`
- **Neither `gcloud` nor `firebase` is installed** on this machine, and there are
  no application-default credentials. Use `npx firebase-tools@14` for deploys;
  `functions/scripts/add-admin.js` needs `gcloud auth application-default login`.
- **`hosting/` uses npm** (CI runs `npm ci` against `hosting/package-lock.json`).
  `functions/` uses yarn.

## Verification commands

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"

cd functions && npx tsc --noEmit && npx jest      # 116 tests
cd hosting  && npx tsc -b --noEmit && npx vitest run && npm run build   # 17 tests
```

The hosting build must produce a separate `Admin-*.js` chunk and a
`firebase-*.js` chunk; if Firebase ends up in the entry chunk, the lazy split
regressed and `/` got heavy.

## Checklist

- [ ] CI functions deploy is green (secret exists)
- [ ] Signed in, uid captured
- [ ] `admins/{uid}` document created
- [ ] Rules + indexes deployed
- [ ] Dashboard verified end to end
- [ ] Browser API key restricted (websites + APIs), Places key confirmed separate
- [ ] Changes committed and pushed
- [ ] `test` branch deleted locally and on origin
- [ ] This file deleted
