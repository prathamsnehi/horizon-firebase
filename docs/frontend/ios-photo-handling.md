# iOS handoff — quest hero images (embedded base64)

Handoff spec for the **iOS app repo**. The backend change is done; this describes the coordinated client change.

## What changed on the backend

The Maps API key is no longer sent to the client. Quest hero images now arrive **inside the generation response** as base64 bytes — there is **no image URL and no key** anywhere. Contract change in `locationInformation`:

- ❌ removed: `photoURL` (was a Google media URL with the key baked in)
- ✅ added: **photoImageBase64: String?** — base64-encoded image bytes, embedded server-side
- ✅ added: **photoContentType: String?** — e.g. `"image/jpeg"`
- ✅ added: `photoReference: String` — the durable Places handle, used server-side; **the client can ignore it**

Both `generateCuratedQuests` (per quest in `quests[]`) and `generateUserDescribedQuest` (the single `quest`) carry it. The field is **optional/absent** when the place has no photo or the server-side fetch failed.

## What the client must do

1. **Decode once, on receipt.** When a batch/described quest arrives, for each quest with a non-nil `photoImageBase64`, decode it: `Data(base64Encoded: photoImageBase64)`.
2. **Store the Data on the quest object** (SwiftData) — e.g. a `heroImageData: Data?` property. This is the persisted image; there is **no re-fetch**, no URL, no Kingfisher for hero images.
3. **Render from the stored Data** (`UIImage(data:)` / `Image(uiImage:)`) — works offline and instantly on repeat views.
4. **Placeholder fallback** — if `photoImageBase64` is absent (or decode fails), show the existing bundled category placeholder (same as non-location quests).
5. **Lifecycle** — the image `Data` lives with the quest; it's discarded when the quest is regenerated (when curated quests are replaced by new curated quests, or old described quest is replaced by the new described quest). No separate image cache to manage or evict.

## Notes

- **Codable:** `photoImageBase64` / `photoContentType` are optional strings; add them to the `LocationInformation` model and remove `photoURL`. Decoding tolerates their absence.
- **No key, no gating work:** because the image rides inside the already-authenticated callable response (App Check + Firebase Auth on `generateCuratedQuests` / `generateUserDescribedQuest`), there's no separate endpoint and no token handling for images.
- **Payload size:** at a fixed \~600px height, each image is ~~50–150 KB (~~+33% as base64). A batch of 3 ≈ \~0.6 MB — well within the callable limit.
- **Remove any Kingfisher usage for images derived from the previous photoURL** (completion photos, if any, are unaffected — those stay local as before).
