# Secrets & configuration

Every configurable value the backend reads lives in **Google Cloud Secret
Manager**, declared as a `defineSecret` param in
[config.ts](../../functions/src/config.ts). Nothing configurable lives in a file
in the repo, and there is no `.env`.

**Why Secret Manager and not `.env`:** a `.env` is gitignored, so CI never sees
it. A deploy triggered by GitHub Actions would resolve every param to its default
and silently overwrite whatever a local deploy had set. Secrets are stored
server-side and attached at deploy time, so the value survives every deploy
regardless of who triggers it.

## The secrets

| Secret | Used by | What it is |
|---|---|---|
| `GEMINI_API_KEY` | LLM router | Google AI Studio key (primary provider) |
| `GROQ_API_KEY` | LLM router | Groq free-tier key |
| `MISTRAL_API_KEY` | LLM router | Mistral free-tier key |
| `CEREBRAS_API_KEY` | LLM router | Cerebras free-tier key |
| `PLACES_API_KEY` | Maps integration | Places API (New) key — **never sent to clients** |
| `RATE_LIMIT_EXEMPT_UIDS` | Both callables | Comma-separated uids exempt from the 24h limit |

## Setting a secret

```bash
firebase functions:secrets:set RATE_LIMIT_EXEMPT_UIDS
# paste the value when prompted, then redeploy for it to take effect:
firebase deploy --only functions
```

Other useful commands:

```bash
firebase functions:secrets:access RATE_LIMIT_EXEMPT_UIDS   # print the current value
firebase functions:secrets:describe RATE_LIMIT_EXEMPT_UIDS # versions + metadata
firebase functions:secrets:prune                           # delete unused versions
```

A secret is only readable by a function that **declares** it. `RATE_LIMIT_EXEMPT_UIDS`
is attached to the two callables via `CALLABLE_SECRETS` in
[controllers/quests.ts](../../functions/src/controllers/quests.ts); the pre-gen
task never rate-limits, so it deliberately does not receive it.

## `RATE_LIMIT_EXEMPT_UIDS` in detail

Developer accounts that need to generate freely while testing, bypassing the
per-user 24h window on both the curated and described lanes.

```
# one uid
wjydGLbytkdSoo76h3nI9i19N4z1

# several
wjydGLbytkdSoo76h3nI9i19N4z1,someOtherDevUid
```

Find a uid in the Firebase console under **Authentication → Users → User UID**.

- **Whitespace around entries is trimmed**, empty entries are ignored, and a
  partial uid never matches.
- **Unset resolves to `""`** — nobody exempt — so an environment that configures
  nothing gates every user normally. Resolution also **fails closed**: if the
  value cannot be read, nobody is exempt.
- **Safe to leave configured in production.** `request.auth.uid` comes from a
  signed Firebase Auth token, so only the account owner can present it, and total
  spend stays bounded by the Maps daily quotas and the per-provider LLM rate
  windows.
- The bypass also skips the concurrent-duplicate guard (no pending stamp is
  written), which is intentional for an account generating repeatedly.

Behaviour is pinned by
[rateLimitExemption.test.ts](../../functions/src/tests/integrations/rateLimitExemption.test.ts).

## Notes

- **A declared secret must exist before deploying.** If `RATE_LIMIT_EXEMPT_UIDS`
  has never been set, `firebase deploy` will fail (or prompt to create it, which
  a `--non-interactive` CI run cannot answer). Create it once — an empty-ish
  placeholder is fine — and CI deploys stay green.
- **Adding a new secret** means declaring it in `config.ts` *and* adding it to the
  relevant function's `secrets` array, otherwise it is undefined at runtime.
- **Changing a secret requires a redeploy** to bind the new version.
- Provider keys are never exposed to clients; the Maps key in particular stays
  server-side, with photo bytes embedded in the response instead. See
  [api-contracts.md](../api/api-contracts.md).
