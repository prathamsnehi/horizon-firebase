# iOS handoff: `deviceId` → `uid` migration

The backend no longer uses `deviceId`. All per-user identity is now derived from
the authenticated Firebase Auth `uid` (already present on every call via App
Check + Auth). The client must stop sending `deviceId` in its requests.

## 1. Remove `deviceId` from both callable payloads

**`generateCuratedQuests`** — request body is now:

```jsonc
{ "profile": { /* …UserProfile… */ }, "excludeTitles": ["…"] } // excludeTitles optional
```

(previously also carried `"deviceId"`)

**`generateUserDescribedQuest`** — request body is now:

```jsonc
{ "prompt": "…", "profile": { /* …UserProfile… */ } }
```

(previously also carried `"deviceId"`)

Delete the `deviceId` key from wherever these two `HTTPSCallable` payloads are
built (dictionaries or `Encodable` structs). **Response shapes are unchanged** —
no decoding changes needed.

## 2. Delete the device-ID plumbing itself

If any code generates/persists a device identifier *solely* to send it here —
e.g. `UIDevice.current.identifierForVendor`, or a UUID stashed in Keychain /
`UserDefaults` — it can be removed. If that same identifier is used elsewhere
(analytics, etc.), leave the source but stop attaching it to these two calls.

## 3. Auth — no new work

These calls require the user to be signed in (Firebase Auth), but that was
**already** enforced server-side. No new sign-in logic; just don't call these
before auth completes (unchanged from today).

## 4. Behavioral note (awareness only)

Identity is now **per-user**, not per-device. A user signed into the same account
on two devices shares one pre-gen cache and one daily quota — which was already
the case for rate limits (one curated + one described per day per account), so
this just makes the cache consistent with it. Reinstalls no longer orphan a
device's cache, since `uid` survives reinstall.

## 5. Rollout

Old builds that still send `deviceId` will **not** break — Cloud Functions
silently ignores unknown payload fields, and the server no longer reads it. So
there's **no forced-update requirement**; ship the cleaned-up client whenever
convenient.
