# Horizon v2 — Self-Host Blueprint (DEFERRED)

> **STATUS: DEFERRED — do not build yet.** The current backend already delivers the full quest loop
> (Scout → Google Places → Writer → base64 photo). v2 changes *how places and photos are sourced*,
> not what the user experiences — and its only motivation, **cost**, does not bite until ~500 MAU
> because Google's free tiers cover us until then. This folder is the ready-to-execute blueprint for
> when that trigger fires. Everything here is design-of-record, not work-in-progress.

## Read in this order

1. **[simplified-architecture-changes.md](./simplified-architecture-changes.md)** — every decision in
   plain language (a "busy developer" version and a "grandpa" version). Start here.
2. **[horizon-architecture-v2.md](./horizon-architecture-v2.md)** — the full technical design of
   record (corpus, retrieval, scoring, tiers, images, fallback, data model, API, build order).
3. This README — the decision to defer, the trigger, and the cost math behind it.

## Why we deferred (the analysis)

- **Google's free tiers cover us at low scale.** Text Search Pro = 5,000 free/month; Place Photo
  (New) = 1,000 free/month, $7/1k after. Below ~500 MAU these largely absorb usage → near-$0.
- **Photos and search are coupled on Google.** A Google photo needs a photo *reference*, which only
  comes back from a Google API call — Overture carries none. So keeping Google photos forces a Google
  search per served place *regardless* of where place data comes from. Self-hosting place data while
  keeping Google photos saves ~$0. **Search and photos must leave Google together, or not at all.**
- **Foursquare (the only compliant cacheable photo source) is 2.7× Google's per-call price
  ($18.75/1k vs $7/1k) with no free tier.** It only wins via cross-user caching; the crossover vs
  Google base64 is ~500 MAU. Below that, today's Google flow is literally cheaper.
- **Caching Google photos to dodge this is off the table** — breaks the Maps Platform Terms
  (no-caching; photos aren't in the Place-ID exception) *and* infringes the photographers' copyright.
  Key-ban + legal risk, not a loophole.

### Photo cost crossover (2026 pricing, ~30 photos/MAU/mo, est. cache-hit rates)
| MAU | Google base64 (today) | Foursquare + CDN |
|---|---|---|
| 100 | ~$14/mo | ~$31/mo |
| 500 | ~$98/mo | ~$98/mo ← crossover |
| 1,000 | ~$203/mo | ~$141/mo |
| 10,000 | ~$2,093/mo | ~$565/mo |

## The trigger

Revisit when approaching **~500 MAU**, or sooner if the **Google Maps monthly bill crosses a
threshold** (e.g. a few hundred $/mo). Add a **GCP billing alert** so this surfaces from data, not a
surprise invoice.

## Constraints locked for the eventual build

- Build search **and** photos off Google **together** (one migration) — that's the only way it saves
  money.
- **Photos: Foursquare (cacheable, "Powered by Foursquare" attribution) → free identity sources
  (Wikidata `P18` / OSM `image`) → category placeholder.** Served from our own storage/CDN.
- **NO AI in the image path — ever.** No vision/identity check, no image generation. (This deletes
  the proximity-Commons rung, the only thing that needed a check — a simplification.)
- **NO `og:image`/website-scrape rung** — dropped (coin-flip quality + licensing gray area).
- **Static tiers** at first (seeded from `experimentationLevel`); Thompson bandit deferred further,
  until real completion data exists.
- Global-from-day-one makes the Google-fallback **circuit breaker + rate-limited region creation** a
  pre-traffic gate, not a late add.

## The one thing worth doing NOW (optional, cheap, decoupled from v2)

A **per-SKU daily budget circuit breaker** on the current Google calls
(`budget_counters/{sku}:{date}`, checked before each paid call, hard-degrade to generic quests on
cap) — mirrors the existing `reserveRateLimitSlot` transaction pattern in
`functions/src/integrations/firestore.ts`. Protects against runaway spend/abuse at any scale and
gives early visibility into the ~500 MAU trigger. Not part of v2 — a standalone safety add to today's
backend if wanted.
