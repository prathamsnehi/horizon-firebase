**o&#x20;**

# Horizon v2 — Architecture Changes in Plain Language

> **STATUS: DEFERRED — not being built yet.** We costed this out and decided to _wait_. Google's
> free tiers cover us cheaply until roughly **500 monthly active users**, and the pieces are
> coupled (see §0 and §9) so a half-build saves nothing. Today's backend stays exactly as it is.
> This doc describes the design we'll build **as one unit** when we cross \~500 MAU (or when the
> Google bill crosses a threshold). Two things below are **locked out of that eventual build:** any
> **AI looking at or generating photos**, and the **venue-website (og:image) source** — both cut.

This is the "explain it like I'm busy" and "explain it like I'm your grandpa" companion to
`horizon-architecture-v2.md`. Every big decision appears twice: once in **simple developer
terms**, once in a **grandpa version** with no jargon. Read whichever one you need.

**The one-sentence version of everything below:** today we _rent_ our places and photos from
Google and pay every single time we hand one to a user; v2 is about _owning_ our own copy so we
pay once and give it out for free forever.

---

## 0. The core shift — rent vs. own

**Dev version.** Google Places is our only external dependency and only variable cost. Its search
is metered per call and its photos are _uncacheable by contract_, so cost scales linearly with
usage and never amortizes. v2 builds our own place database (from free open data) and our own
image cache, and demotes Google to a rare fallback.

**Grandpa version.** Right now, every time someone asks our app "where should I go today?", we
phone a company called Google, and they charge us a small fee for the answer and the photo — every
single time, even if it's the same coffee shop we already asked about yesterday. That adds up fast.
So instead, we're going to build our _own_ address book of interesting places, with our own photos.
We pay once to fill the book, and after that, handing pages out to people is free.

---

## 1. Where places come from — our own corpus (Overture), not Google

**Dev version.** Replace the live Google `searchText` call with retrieval from a self-hosted place
corpus built from **Overture Maps** (free, permissively licensed open data), enriched with
OpenStreetMap. Google stays only as a bounded fallback (§9).

**Grandpa version.** There's a free public map of the world — think of it like a giant public
library of every shop, park, and museum on earth. We copy the parts we need into our own notebook.
Now when someone wants a place, we look in our own notebook instead of paying Google to look in
theirs.

---

## 2. How we find the _right_ place — "meaning search" (embeddings + vector search)

**Dev version.** The Scout LLM still emits freeform concept text (e.g. "a rooftop where you can
watch planes land"). We turn that text into a 384-dimension vector (an "embedding") and use
Firestore's built-in vector search (`findNearest`) to pull the closest matches from our corpus.
Freeform costs money only against a rented API; against our own data it's just a math scan.

**Grandpa version.** Instead of matching exact keywords, the computer understands the _meaning_ of
a request. If someone says "a cozy place to read on a rainy day," it finds quiet cafés and
libraries — even if nobody used the words "cozy" or "rainy." It's like a librarian who gets the
_vibe_ of what you want, not just the exact title you asked for.

---

## 3. Splitting the world into "packs" (regional bundles)

**Dev version.** The corpus is partitioned into regional "packs" (\~50km radius, nearest-centroid
assignment, \~30k POIs each, capped by stratified sampling across prominence terciles). Only packs
served in the last 60 days refresh monthly; dormant regions rebuild lazily on next use. Hundreds of
packs total, so a linear scan over centroids is fine — no fancy spatial index.

**Grandpa version.** We can't copy the whole world's map into one giant notebook — it'd be too big
and slow. So we split it into city-sized chapters. When someone opens the app in Chicago, we only
flip to the Chicago chapter. We only bother re-checking and updating the chapters people actually
visit; the quiet ones we leave alone until someone shows up.

---

## 4. Deciding which places are _good_ — three scores

**Dev version.** Each place gets three scores: **Legitimacy** (is it real, open, correctly
located?), **Worthiness** (would anyone want to go?), and **Prominence** (how famous is it?).
Legitimacy and Worthiness are quality _floors_; Prominence is only used to sort places into tiers,
never to rank them.

**Grandpa version.** Before we recommend a place, we ask three questions about it. One: is this a
real, open place and not a closed-down building or someone's house? Two: would a normal person
actually enjoy going there (a park, yes; a storage locker, no)? Three: how well-known is it? The
first two are pass/fail quality checks. The third just decides which "shelf" we file it on.

---

## 5. Three discovery tiers — and why hidden gems get graded harder

**Dev version.** Places bucket into **Hidden / Local / Well-known** thirds by prominence. The
quality **floors rise as prominence falls**: an obscure place must clear stricter Legitimacy and
Worthiness bars than a famous one, because a famous museum is already vouched for by thousands of
signals and an unknown spot isn't. This is what makes "hidden" mean _gem_, not _random dot_.

**Grandpa version.** We sort places into three baskets: famous, local favorites, and hidden gems.
Here's the trick: before we send you across town to some place _nobody_ has heard of, we make it
prove itself much harder than we'd make a famous museum prove itself — because the famous one is
already trusted by millions, and the unknown one has to earn that trust on its own. That's how
"hidden gem" ends up meaning _treasure_ instead of _sketchy surprise_.

---

## 6. Choosing tiers per person — fixed recipe now, learning later

**Dev version.** At launch, tier weights are **static**, seeded from the user's
`experimentationLevel` (adventurous users skew toward Hidden, cautious toward Well-known). The
adaptive **Thompson-sampling bandit** — which learns each user's taste from their completions — is
**deferred** until we have real completion data (a bandit with zero data is just its starting
guess, so there's nothing to learn from yet).

**Grandpa version.** For now, we use a simple rule of thumb: bold users get more hidden gems, cautious
users get more famous spots, based on a slider they set when they sign up. Later — once people have
actually used the app and we can see what they finish versus skip — we'll teach the app to _learn_
each person's taste automatically. We're not building the learning part yet because it has nothing
to learn from until real people use it.

---

## 7. Photos that are actually of the place — "identity first", **no AI**

**Dev version.** The old idea matched photos on _proximity_ (a photo taken near the coordinates) —
but near ≠ of. The eventual design matches on _identity_ only, via a short waterfall:
user-submitted → **Foursquare** (crowd-sourced venue photos, comparable quality to Google, and
**cacheable** under their terms) → free identity photos (Wikidata `P18` / OSM `image` tag) →
category placeholder. **No AI anywhere** — no "is this the right photo?" vision check, no image
generation. Dropping AI actually _removes_ a rung: the only source that ever needed a check was
proximity-based Commons, so it's cut entirely. The website-`og:image` source is cut too (coin-flip
quality + licensing gray area).

**Grandpa version.** Before, we grabbed any photo taken _near_ a place — which sometimes gave you a
picture of the parking lot next door instead of the restaurant. The new rule: only use a photo if
it's tied to _that exact place_ by name — first from people who've been there, then from a big photo
library called Foursquare (the same kind of real customer photos Google has, but one we're
_allowed_ to keep our own copy of), then from free public records. **No computer ever looks at a
photo to judge it, and no computer ever makes one up.** If we genuinely have no real picture of a
place, we show a plain stand-in — never a fake one.

_(One honest caveat kept in the open: Foursquare requires a small "Powered by Foursquare" credit
wherever its photos appear.)_

_(Reminder: this whole photo path is part of the deferred build — until we cross \~500 MAU, photos
keep coming live from Google exactly as they do today.)_

---

## 8. Fetch each photo once, keep it forever — the cache

**Dev version.** A read-through cache: first serve of a place resolves its photo through the
waterfall, normalizes to 800px WebP, and stores it. Every serve after that is a cache hit. Because
the cache is keyed **per place, shared across all users**, 10,000 users in a city collapse onto a
few hundred unique venues — we pay to discover each photo once. **Negative caching is mandatory**:
places with no photo anywhere get remembered as "no photo, retry later" so we don't re-hunt on every
request.

**Grandpa version.** The first time anyone asks about a café, we go find its photo and paste it into
our notebook. Everybody who asks about that café afterward gets the same pasted photo instantly — no
new work. And if a place simply has no photo anywhere, we write down "no photo, don't bother looking
again for a while," so we're not sending someone on the same hopeless errand over and over.

---

## 9. Where photos live and how they reach the phone — CDN URL, not base64

**Dev version.** Images are stored on **Cloudflare R2** behind a CDN, with content-hashed immutable
paths and a 1-year cache header. The API returns a **URL** (`photoURL`) instead of stuffing the raw
image bytes (base64) into the response. Attribution/license is captured at resolution time (once
bytes are in the bucket, provenance is unrecoverable).

**Grandpa version.** Instead of mailing the whole photo inside every reply — which is slow and
heavy — we store photos on a fast worldwide delivery network and just send the phone a _link_. The
phone grabs the picture from the nearest fast server. Same as how a website shows you an image: it
doesn't email you the file, it points your browser to it.

---

## 10. Same place, never the same quest twice

**Dev version.** Places may repeat freely; quests never do. We store each completed quest's
_embedding_ (meaning-vector) per user, feed prior quests-at-this-place into the Writer prompt as
exclusions, and reject any new quest that's too similar (cosine > 0.85) to a past one there. Title
matching isn't enough — "browse the poetry section" and "spend 20 minutes in the poetry aisle" are
the same quest with different words.

**Grandpa version.** You might get sent to the same bookstore more than once — that's fine, good
places are worth revisiting. But we'll never give you the same _task_ twice. The app remembers what
it already asked you to do there and deliberately comes up with something fresh, even if you word it
differently. This is what keeps the app from running out of ideas in your town.

---

## 11. When we still call Google — rare, and with a spending guard

**Dev version.** Google is used in exactly two bounded cases: **cold start** (first user in an
uncovered region while its pack builds) and **thin-region enrichment** (a built pack with too few
candidates). Both sit behind a **circuit breaker** (per-SKU daily spend counter → hard degrade to
generic quests) and **rate-limited region creation** (client coords are untrusted, so spoofed
coordinates must not be able to trigger unlimited paid pack builds). Because we launch globally,
these guards ship **before** real traffic, not after.

**Grandpa version.** We still keep Google on speed-dial for two emergencies: when someone opens the
app in a brand-new city we haven't mapped yet, or when our notebook for an area is too thin. But we
put a hard spending limit on that phone: if the day's bill gets too high, we stop calling and hand
out simpler suggestions instead. And since anyone can _claim_ to be anywhere, we make sure a prankster
sending fake locations can't trick us into running up a huge bill.

---

## 12. Learning from users — completions and reports

**Dev version.** Reward signal = quest completion, plus a bonus for a submitted photo (which pays
twice: better bandit signal _and_ top-rung image content). Reports come in three flavors — **unsafe**
(immediate hard suppression, safety is asymmetric), **closed** (3 independent reports → suppress),
**wrong** (Wilson lower bound feeds `feedback_penalty`, lowering the place's Worthiness). Reports are
the only correction faster than the monthly refresh.

**Grandpa version.** We learn from what people do. Finishing a quest is a thumbs-up; adding their own
photo is a double thumbs-up (it helps us _and_ gives the next person a real picture). People can also
flag places: "this is unsafe" gets it pulled instantly, "this is closed" pulls it after a few people
agree, and "this is wrong" quietly pushes it down the list. That's how a place that shut down last
week disappears without us waiting a whole month to notice.

---

## 13. What we deliberately deleted (and why it's a good thing)

**Dev version.** v2 removes machinery an earlier over-engineered design had accumulated: H3 geo-cells
(no longer needed once retrieval prefilters on `pack_id`), Mapillary street imagery (rarely _of_ the
venue), int8 vector quantization (Firestore stores doubles anyway), MMR variety re-ranking (batch
variety is the Scout's job, not a post-filter's), a redundant "corroboration" scoring term, and the
old name/distance photo heuristics (replaced by identity-only photo sourcing — no AI check).

**Grandpa version.** A big part of the new plan is _throwing things away_, not adding them. The old
design had collected a bunch of clever-but-pointless gadgets over time. We're tossing the ones that
either duplicated work we already do, or tried to fix problems at the wrong end. Less machinery means
fewer things that can break. Simpler is the feature.

---

## The trade we're accepting

**Dev version.** This is roughly a 5–10× increase in backend surface area (a Cloud Run build
pipeline, a vector index, a scoring system, an image CDN) traded for near-zero marginal cost per
request at scale. The bet: we'd rather own a bigger machine that's cheap to run than rent a small one
that gets expensive fast.

**Grandpa version.** The new way is more work to build — more moving parts, more to look after. But
once it's built, giving each person their daily adventure costs us almost nothing. We're choosing to
build our own well instead of buying bottled water forever.
