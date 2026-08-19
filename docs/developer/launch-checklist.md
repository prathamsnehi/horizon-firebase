# Launch checklist

What's actually left before going public. Everything not listed here is done.

## Already handled

Server-side rate limiting (per-uid, 24h, crash-safe), App Check on both
callables, deny-all Firestore rules, keys in Secret Manager, the Maps key never
reaching a client, input size caps, provider failover, Maps quota caps, billing
alerts, and account-deletion cleanup. Details in
[../agent/architecture.md](../agent/architecture.md).

## Left to do

### Privacy paperwork
- [ ] Write down what's stored per user: rate-limit stamps + the cached next
      batch. That's the whole list.
- [ ] Draft a privacy policy. It needs to cover three things: profiles go to
      third-party AI providers, place data comes from Google Maps, and photos
      and journal entries stay on the device.
- [ ] Mention that de-identified generation data is kept to improve the app —
      see [../agent/observability.md](../agent/observability.md) for exactly
      what that is.

### Test it for real
- [ ] Fresh install on a physical device, Release build, real App Check:
      onboard → get quests → get them again (should be instant) → describe one →
      check the photos render.
- [ ] Try to break it: no App Check token, missing profile, a 10,000-character
      prompt, a prompt the moderation blocks. All should fail cleanly.
- [ ] Hit the daily limit and confirm the app shows a friendly message.
- [ ] Turn off the primary AI provider and confirm generation still works via
      failover.

### Housekeeping
- [ ] Create the `RATE_LIMIT_EXEMPT_UIDS` secret before the next deploy, or it
      will fail — see [secrets.md](./secrets.md).
- [ ] Delete the `test` branch, locally and on GitHub. Its work is merged, and
      leaving it around is how the two-branch problem starts again.

## Worth considering, not blocking

A daily spend cap that hard-stops paid Google Places calls and falls back to
location-free quests. Protects against a runaway bill at any scale. Sketched in
[../agent/backlog.md](../agent/backlog.md).
