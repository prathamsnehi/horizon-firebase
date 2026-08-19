# Secrets

All keys and config live in **Google Cloud Secret Manager**. There is no `.env`
file in this project — a gitignored file is invisible to CI, so a pipeline deploy
would silently reset it.

## Set or change one

```bash
firebase functions:secrets:set RATE_LIMIT_EXEMPT_UIDS
firebase deploy --only functions      # required — secrets bind at deploy time
```

```bash
firebase functions:secrets:access RATE_LIMIT_EXEMPT_UIDS   # see current value
firebase functions:secrets:prune                           # clean old versions
```

## What exists

| Secret | What |
|---|---|
| `GEMINI_API_KEY` | AI Studio key — the primary model provider |
| `GROQ_API_KEY` | Groq free tier |
| `MISTRAL_API_KEY` | Mistral free tier |
| `CEREBRAS_API_KEY` | Cerebras free tier |
| `PLACES_API_KEY` | Google Places — never sent to clients |
| `RATE_LIMIT_EXEMPT_UIDS` | Accounts that skip the 24h limit |

## Skipping the daily limit while testing

Put your own uid in `RATE_LIMIT_EXEMPT_UIDS` to generate without the 24h wait.
Comma-separate for several. Find yours in the Firebase console under
**Authentication → Users → User UID**.

```
wjydGLbytkdSoo76h3nI9i19N4z1,someOtherDevUid
```

Leave it empty and everyone is limited normally. It's safe to leave set in
production — a uid comes from a signed Auth token, so nobody else can claim
yours, and your Maps and model quotas still cap total spend.

## Two gotchas

**A secret must exist before you deploy.** If it has never been set,
`firebase deploy` fails, and CI can't answer the prompt to create it. Set it once
(a single space is a fine placeholder) and deploys stay green.

**Adding a new secret takes two steps:** declare it in `functions/src/config.ts`,
*and* add it to the `secrets` array of the functions that use it. Miss the second
and it's undefined at runtime.
