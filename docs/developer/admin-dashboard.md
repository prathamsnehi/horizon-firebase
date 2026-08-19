# Admin dashboard

`/admin` on the deployed site. It reads the anonymous `generation_samples`
records straight from Firestore — no scripts and no Admin SDK. It replaced the
old `get-trace.js` dump-and-paste loop, which has been deleted.

## Getting access

Three one-time steps:

1. **Enable Google sign-in** — Firebase console → Authentication → Sign-in
   method → Google.
2. **Add yourself** — create a Firestore document at `admins/<your-uid>`. The
   contents don't matter; only its existence does. Find your uid under
   Authentication → Users.
3. **Deploy the rules** — `firebase deploy --only firestore:rules,firestore:indexes`

To give someone else access, create an `admins/{their-uid}` doc. To revoke,
delete it. Both take effect immediately, with no deploy.

## How the gate works

Signing in with Google is not enough on its own. The Firestore security rules
check for your `admins/{uid}` document before returning any sample, so the
allowlist is enforced by the database rather than by the page — someone who
pokes at the JavaScript still gets nothing.

## What's on it

**Dashboard** — pick a window (24h / 48h / 7d) and you get:

- how many generations ran, how many succeeded, how many failed
- p50 and p95 latency, overall and per pipeline stage
- **Maps resolution rate** — how often the Scout's search actually found a real
  place. If this drops below 50%, the Scout prompt is the suspect, not Google.
- cache hit rate, generic-fallback rate, and how often the LLM router had to
  fail over to a backup provider
- volume over time with failures stacked on top
- which models are actually serving traffic
- the last 10 failures, each linking to its full trace

**Logs** — every sample, filterable by type or outcome, with a detail view
showing the pipeline as a waterfall: each stage as a bar you can click to see its
inputs and outputs, plus the provider failover chain when one happened.

## Local development

```bash
cd hosting
npm install
npm run dev      # http://localhost:5174
```

Sign-in works against the real Firebase project from localhost, so the dashboard
shows live data while you develop.

## One limit worth knowing

The dashboard reads at most the 300 most recent samples in the window, and says
so on screen when it hits that ceiling. Sample documents are large and the web
SDK can't fetch a subset of fields, so this keeps a page load bounded. At current
volume it's not a constraint; if generations ever exceed roughly a thousand a
day, the fix is a compact summary collection — noted in
[../agent/backlog.md](../agent/backlog.md).
