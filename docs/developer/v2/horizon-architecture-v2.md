# Horizon — Places, Discovery & Imagery Architecture (v2)

**Supersedes v1 (`horizon-architecture-decisions.md`).** Same decisions, less machinery.
Every removal is listed in §2 so you can see what was cut and why.

Context: **pre-launch, no users, global coverage.**

---

## 1. Decisions of record

| # | Decision | Chosen |
|---|---|---|
| 1 | Place source | Own Overture corpus + Google fallback |
| 2 | Scout output | Freeform text, permanently |
| 3 | Geography | Global, on-demand pack builds |
| 4 | Cold start | Google fallback while pack builds |
| 5 | Pack size | ~50km radius, nearest-centroid assignment |
| 6 | Index | Firestore vector search |
| 7 | Embeddings | 384-dim |
| 8 | Pack refresh | Monthly, active packs only |
| 9 | Image fetch | Read-through cache, hot on miss |
| 10 | Image floor | Real photo preferred, placeholder fallback |
| 11 | Image delivery | CDN URL only |
| 12 | Image storage | Cloudflare R2 + CDN |
| 13 | Scoring axes | Legitimacy / Worthiness / Prominence |
| 14 | `category_prior` | LLM drafts, human review |
| 15 | Tiers | Three, even thirds by prominence |
| 16 | Tier adaptation | Thompson sampling, fully adaptive |
| 17 | Priors | Seeded from `experimentationLevel` |
| 18 | Reward | Completions over served, photo bonus |
| 19 | Batch composition | Free — weights decide |
| 20 | Repeats | Repeat place freely, never repeat quest |
| 21 | Quest dedup | Embedding similarity + prior quests in prompt |
| 22 | Tier visibility | Subtle indicator |
| 23 | Thin regions | Google enriches pack once |
| 24 | Reporting | Full taxonomy: closed / wrong / unsafe |

**On #16:** full adaptation with no floor is safe *only because* Thompson keeps wide
posteriors on ignored tiers and re-samples them on uncertainty. If you ever swap it for
exponential smoothing, add a floor back or a tier can die permanently.

---

## 2. What v2 removes

| Removed | Why |
|---|---|
| **H3 entirely** | Existed for concept-pool keys; freeform Scout deleted concept pools. Retrieval prefilters on `pack_id`, so there's no geo filtering left. Pack assignment = nearest centroid |
| **Mapillary** | Street-level imagery is rarely representative of a venue. Removes a vendor, a share-alike obligation, and an attribution requirement |
| **Commons geosearch as a blind rung** | Proximity ≠ identity. Now gated behind a vision check (§7) |
| **int8 quantization** | Firestore stores vectors as doubles. Carried over from the in-memory design you didn't pick |
| **MMR and its replacement constraints** | Batch variety is the Scout's job. Post-filtering on category or distance papers over an upstream problem and returns worse places. Only exact-place dedup remains |
| **`corroboration` term in Worthiness** | Recomputed Legitimacy's own inputs |
| **Name-similarity / distance heuristics for images** | Replaced by one vision call, which is both shorter and more accurate |
| **Separate 25-day rehydration cron** | Folded into the monthly pack refresh |

---

## 3. Architecture

```
REQUEST PATH — no paid external calls in steady state

Controller ─► pregen cache ─► HIT: serve (images warm)
     │
     └─ MISS ─► Scout LLM ─► freeform concept text
                    │
              embed (384-d) ─► Firestore findNearest
                    │            prefilter: pack_id, is_servable
                    ▼
              tier assign ─► Thompson draw per slot ─► 2 dedup constraints
                    │
              ImageResolver (read-through)
                    │
              Writer LLM (+ prior quests here) ─► response

BUILD PATH — Cloud Run job, per region + monthly refresh
```

---

## 4. Place corpus

**Pack assignment:** nearest pack centroid within 50km; otherwise build a new pack centered
on the user's coordinates. No spatial indexing scheme needed — you'll have hundreds of packs,
not millions, so a linear scan over centroids is fine.

**Cap:** 30,000 POIs. When an extract exceeds it, sample **stratified across prominence
terciles** — never top-N, which deletes exactly the hidden tier.

**Build pipeline** (Cloud Run, ~5–12 min — exceeds your 60s function timeout):

```
1. Overture extract    DuckDB over remote GeoParquet, bbox pushdown   30s–3m
2. OSM enrichment      Overpass: tags, wikidata links, image tags     30s–2m
3. Filter & dedupe     name required, confidence ≥ 0.5, allowlist     ~10s
4. Score               L / W / P; percentile within category          ~30s
5. Embed               384-d, batched                                 1–5m
6. Images              top 500 by W only                              1–2m
7. Publish
```

**Refresh:** monthly against the new Overture release, only for packs served in the last 60
days. Dormant regions rebuild on next use. Google-sourced records refresh in the same job.

---

## 5. Retrieval

```
query_embedding = embed(scout_concept_text)
candidates = places
    .where('pack_id', '==', pack_id)
    .where('is_servable', '==', true)
    .findNearest('embedding', query_embedding, limit=200)
```

Freeform is better here than an enum would have been — "a rooftop where you can watch planes
land" matches on meaning. It only costs money pointed at a rented API; pointed at your own
corpus it's a vector scan.

**Build the `(pack_id, is_servable)` composite index before launch.** Firestore index builds
on large collections are slow.

---

## 6. Scoring

**Legitimacy and Worthiness are floors. Prominence is only a bucketing key — it never appears
in ranking.**

### Legitimacy `L` — is it real, open, correctly located?

| Signal | Normalization | Weight |
|---|---|---|
| Overture `confidence` | clamp((c−0.5)/0.45) | 0.30 |
| Multi-sourcing (`sources` length) | min(n/3, 1) | 0.20 |
| Contact completeness | fraction of {website, phone, hours, social} | 0.20 |
| OSM tag richness | min(tags/8, 1) | 0.15 |
| Verification recency | exp(−age_days/365) | 0.15 |

Hard exclusions before scoring: `operating_status` closed; FSQ `unresolved_flags`; OSM
lifecycle prefixes (`disused:`/`abandoned:`/`demolished:`/`construction:`); `access=private`;
residential buildings; danger and trespass category blocklist.

### Worthiness `W` — would anyone want to go?

```
W = category_prior × (1 − feedback_penalty)
```

That's it. `category_prior` was carrying 45% of the weight in v1 and the other terms
duplicated Legitimacy. `feedback_penalty` is a Wilson lower bound on `wrong` reports.

`category_prior ≤ 0.15` is never served regardless of other scores — the rule that guarantees
nobody gets a quest at a self-storage facility.

**Building it:** have the LLM emit `{category, score, one_line_rationale}` for all ~300
Overture `basic_category` labels. Review the rationales, not the scores — much faster. Check
into the repo as versioned JSON. It is config, not data.

### Prominence `P` and tiers

Two signals, log-scaled, percentile-ranked **within (basic_category, pack)**:

```
P_raw = 0.6 · log1p(wikipedia_pageviews_90d) + 0.4 · log1p(commons_photo_count)
```

Most everyday POIs have no Wikipedia presence, so photo count carries the long tail. Keep a
`has_notability` flag so you can tell the two regimes apart when debugging.

| Tier | `P_pct` | `L` floor | `W` floor |
|---|---|---|---|
| **Hidden** | 0.00 – 0.33 | 0.70 | 0.80 |
| **Local** | 0.33 – 0.67 | 0.50 | 0.55 |
| **Well-known** | 0.67 – 1.00 | 0.35 | 0.35 |

**Floors rise as prominence falls.** A famous museum is corroborated by thousands of
independent signals; an obscure place has none. Before sending someone across town to
something nobody has heard of, demand stronger direct evidence. This is what makes "hidden"
mean *gem* rather than *unvetted dot*.

---

## 7. Images — identity first

**The v1 waterfall matched on proximity. Google's photos are good because they match on
identity.** That's the whole difference, and it's what v2 fixes.

### Waterfall

| # | Source | Bound by | Notes |
|---|---|---|---|
| 1 | **User-submitted** | Identity | Grows with usage; best long-term |
| 2 | **`og:image` from the venue's website** | Identity | HTTP GET + one meta tag parse |
| 3 | **Wikidata `P18` / OSM `image=*`** | Identity | Sparse but excellent |
| 4 | **Commons geosearch, vision-verified** | Proximity → verified | Only rung needing the check |
| 5 | **Bundled category placeholder** | — | Your chosen floor |

Rungs 1–3 are identity-bound and need no verification. Rung 4 is the only one where the
image might not be of the place, so it gets one check.

### The vision check

```
"Is this a recognizable photo of {name}, a {category}?
 Is it usable as a hero image — not a logo, menu, sign, interior detail, or empty lot?
 Reply {\"ok\": true|false}"
```

One call on the router you already run, once per place, cached forever. This **replaces**
name-similarity matching, distance thresholds, and category heuristics — less code than what
it removes, and it catches failures heuristics can't.

### On `og:image`

Overture's `websites` field gives you the venue's own site, and businesses lead with their
best photo of themselves. This is likely your highest-quality source.

It's their copyrighted image. Open Graph exists specifically so third parties can republish
it in previews, which is a strong argument for this use — but it's convention, not a license.
**Attribute and link back to the business**, and treat this as a judgment call you're making
with open eyes.

### Read-through cache

```
getHeroImage(place_key):
  1. place_images/{place_key} → hit? return R2 CDN URL        (~10ms)
  2. Miss → walk waterfall, normalize to 800px WebP,
            upload R2, write manifest
  3. Hard failure → placeholder + negative cache with backoff
```

**Per-source timeout 3s, all three images in parallel, ~15s overall budget.** You asked for
no timeout; your 60s function timeout *is* one, and unbounded waiting means a hung socket
fails the whole quest response instead of one image. Per-source bounds keep the waterfall
moving toward a real photo rather than blocking on a dead upstream.

**Warm during pregeneration.** Your existing Cloud Task builds tomorrow's batch — resolve
those images there. The hot path then almost never fires.

**Negative caching is mandatory.** Some places have no image anywhere. Without
`{resolved: false, attempts, next_retry_at}` and backoff, you re-run the waterfall on every
serve forever.

### Storage

R2 with a custom domain so Cloudflare's CDN fronts it; content-hashed immutable paths;
`Cache-Control: public, max-age=31536000, immutable`. Bytes in R2, attribution manifest in
Firestore. Credentials in Secret Manager.

Capture attribution at resolution time — once bytes are in your bucket the provenance is
unrecoverable.

---

## 8. Tier selection

### Thompson sampling per tier

```
α = completions + 0.5·photo_submissions + prior_α
β = (served − completions) + prior_β
```

Absolute rates will be low — at 3 quests/day most go undone from capacity, not distaste.
That's fine: capacity depresses all three tiers equally, so the comparison stays valid.
Don't try to correct for it.

**Priors from `experimentationLevel`** (total strength ~4):

| Level | Hidden | Local | Well-known |
|---|---|---|---|
| 1 | (0.5, 3.5) | (1.5, 2.5) | (2.5, 1.5) |
| 3 | (1.3, 2.7) | (1.3, 2.7) | (1.3, 2.7) |
| 5 | (2.5, 1.5) | (1.5, 2.5) | (0.5, 3.5) |

### Composition

Free — weights decide, tiers may repeat. **Draw a fresh θ per slot**, not one draw reused
three times, or one tier sweeps all three slots more often than the weights imply.

The only dedup is exact: don't serve the same place twice in one batch. A `Set` of chosen
`place_key`s, checked as you fill slots.

**No category or distance constraints.** Batch variety comes from the Scout emitting three
distinct concepts, not from filtering the results afterward. If two concepts differ, their
categories differ for free; if they don't, that's a Scout prompt problem, and rejecting a
concept's best match on category collision just returns a worse place while leaving the real
bug upstream. Geographic clustering isn't a failure either — three good places within walking
distance is an afternoon, not a defect.

If batches do come back monotonous once you can see real output, fix the Scout prompt. Don't
add a post-filter.

---

## 9. Quest-level novelty

Places repeat freely; quests never do.

History stores `(place_key, quest_embedding, completed_at)`.

```
1. Retrieve prior quests at this place for this user
2. Pass them into the Writer prompt as explicit exclusions
3. Embed the result; reject if cosine > 0.85 against any prior there
4. Regenerate up to 2×, then pick a different place
```

Title matching is insufficient — "Browse the poetry section" and "Spend 20 minutes in the
poetry aisle" are different titles and the same quest.

This is what makes a finite corpus sustainable: at 90 quests/month a user would otherwise
exhaust a metro's worthwhile places within a couple of years.

---

## 10. Google fallback — two bounded uses

Never on the steady-state path.

**Cold start.** First user in an uncovered region, while the pack builds. ~$0.12 once per
region. **Rate-limit region creation** — coordinates come from the client, so spoofed coords
could trigger unlimited builds.

**Thin-region enrichment.** When a built pack yields too few candidates after floors, Google
fills the gap once, into the pack.

This needs care with Google's terms: `place_id` may be stored indefinitely, but names,
addresses, and coordinates may not persist past 30 days.

```
Google-sourced records store:
  google_place_id, L/W/P scores, embedding   permanent (your derived data)
  name / address / coords                     ephemeral, needs_rehydration = true
```

Refresh flagged records during the monthly pack job (well inside 30 days). A thin region
holds a few hundred — about $1/month at $5/1k.

**Circuit breaker:** per-SKU daily spend counter checked before every call, hard degrade to
generic quests. Non-negotiable.

---

## 11. Feedback

**Reward:** completion, plus 0.5 α-bonus for a photo. Photo pays twice — bandit signal and
top-rung image content. Needs EXIF stripping, moderation, upload-time licensing terms.

**Reporting:** closed / wrong / unsafe.

| Report | Effect |
|---|---|
| `unsafe` | **Immediate hard suppression**, pending review. Safety is asymmetric |
| `closed` | 3 independent reports → suppress |
| `wrong` | Wilson lower bound into `feedback_penalty` → lowers `W` |

The only correction loop that beats monthly refreshes — a place that closed last week won't
appear in Overture for a month.

---

## 12. Data model

```
places/{place_key}
  pack_id, gers_id, osm_id, google_place_id?
  name, lat, lng
  basic_category, taxonomy_hierarchy[]
  is_servable, exclusion_reasons[]
  legitimacy, worthiness, prominence_pct, tier
  has_notability, needs_rehydration
  embedding: Vector(384)
  signals: { ov_confidence, n_sources, tag_count,
             wiki_pageviews_90d, commons_photos }
  reports: { closed, wrong, unsafe }
  serves_total, completions

place_images/{place_key}
  r2_path, content_hash, source, license,
  attribution_text, attribution_url,
  resolved, attempts, next_retry_at

packs/{pack_id}
  centroid, radius_km, poi_count, overture_release,
  built_at, last_served_at, status

user_tier_state/{uid}
  { hidden: {α,β}, local: {α,β}, well_known: {α,β} }

user_quest_history/{uid}
  entries: [{ place_key, quest_embedding, title, completed_at }]

budget_counters/{sku}:{yyyymmdd}
```

---

## 13. API contract

```jsonc
"locationInformation": {
  "photoURL": "https://cdn.horizon.app/img/pk_a1b2/hero_800.webp",
  "photoAttribution": { "text": "...", "url": "...", "license": "..." },
  "discoveryTier": { "tier": "hidden", "label": "Hidden gem" }
  // photoImageBase64 / photoContentType / photoReference — removed
}
```

New endpoints: `recordQuestCompletion` (optional photo), `reportPlace`.

Client keeps decode-once-and-store-to-SwiftData, sourced from a URL fetch. Offline behavior
identical after first render.

---

## 14. Build order

1. **`category_prior`** — LLM draft, your review. Everything downstream inherits it.
2. **Pack build job** on Cloud Run. Build three test regions: a dense metro, a small town,
   and somewhere poorly mapped. Thin markets are where this breaks.
3. **Firestore vector index** + retrieval. Verify freeform queries return sane places.
4. **Scoring + tiers**, static weights, no Thompson yet.
5. **Image waterfall** — `og:image` and Wikidata first; add the vision check for rung 4 only
   once you see how much coverage rungs 2–3 actually give you. They may be enough.
6. **Google fallback paths** with circuit breaker, *before* real traffic.
7. **Quest dedup.**
8. **Thompson sampling** last, once completion data exists.

---

## 15. What I'd watch

- **Measure image coverage by rung before building rung 4.** If `og:image` plus Wikidata
  covers 80%+, the vision check may never be worth writing. Don't build it on spec.
- **Thin regions are the real risk of global coverage.** Build a poorly-mapped test pack
  early; don't discover this from a user.
- **The hidden tier surfaces quality problems first**, because its floors do the most work.
  Watch report rate by tier: `wrong`/`closed` climbing toward hidden means `L_floor` is too
  low; completion dropping sharply means `W_floor` is.
- **Free composition plus sparse Thompson looks degenerate early.** Noisy posteriors may hand
  someone three well-known quests several days running. It self-corrects — resist adding
  composition rules before ~30 completions.
- **Pricing and licensing move.** Re-verify Google's SKUs, Overture's schema deprecations,
  and your `og:image` posture before committing. Log the billed SKU per call so drift shows
  up in your data, not your invoice.
