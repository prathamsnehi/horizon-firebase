# Horizon Web Frontend

A desktop-first (mobile-friendly) web prototype of the Horizon app, living in
`/frontend`. It drives the deployed `generateCuratedSidequests` and
`generateUserDescribedSidequest` Cloud Functions and adapts the iOS flows
(Onboarding → Home → Create → Completion → History) and the "Igneous Core"
design system to the web.

**Two-option model.** The product centers on two ways to get a sidequest:
(1) a **curated trio** — three sidequests curated from the user's profile
(`generateCuratedSidequests`, server-controlled at 3), and (2) **describe your
own** — one freeform-prompted sidequest (`generateUserDescribedSidequest`). The
old 10-quest Tinder swipe deck is gone.

> This is a prototyping surface. The real product home is the iOS/SwiftUI app.
> There is **no auth** — all user state lives locally in the browser, mirroring
> the app's SwiftData/local-only model.

## Stack

- **Vite + React + TypeScript**
- **React Router** (`/` landing, `/app/*` product routes)
- **Tailwind CSS** with Igneous Core tokens as CSS variables (light/dark)
- **Type:** self-hosted **Fraunces Variable** (`font-display`, editorial titles)
  + **Inter Variable** (`font-sans`, body) via `@fontsource-variable/*`
- **Framer Motion** (swipe gestures, transitions, curating animation)
- **Zustand** (`persist` → localStorage) for profile + quests
- **IndexedDB** (`idb-keyval`) for completion photos (too large for localStorage)
- **react-leaflet** (OpenStreetMap / Carto tiles, no API key) for the inline map
- **Firebase Web SDK** (`firebase/functions` httpsCallable)

## Getting started

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in your Firebase web config
npm run dev                  # http://localhost:5173
```

### Environment (`frontend/.env.local`)

Get these from Firebase Console → Project settings → Your apps → Web app.

| Var | Notes |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | required |
| `VITE_FIREBASE_AUTH_DOMAIN` | `horizon-sidequests.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `horizon-sidequests` |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | required |
| `VITE_FUNCTIONS_REGION` | defaults to `us-central1` |
| `VITE_USE_MOCK` | `true` serves local fixtures instead of the backend |

App Check is **disabled** server-side, so the web client calls the function
directly with no attestation token.

### Mock mode

Set `VITE_USE_MOCK=true` (or simply leave the Firebase config empty) to serve
fixture sidequests from `src/data/mockSidequests.ts`. This lets you build and
demo the entire UI without a backend. Mock mode is also auto-enabled whenever
the Firebase config is incomplete.

## How it maps to the backend

The web client mirrors the **actual** Cloud Function types in
`functions/src/types.ts` (not the older `docs/api` shapes):

- Sends `CuratedSidequestRequest { profile, excludeTitles?, deviceId }` to
  `generateCuratedSidequests` (count is server-controlled at 3; no longer sent).
  `deviceId` is a stable UUID in localStorage (stands in for the iOS vendor ID).
- Also calls `generateUserDescribedSidequest(prompt)` in `lib/api.ts` for the
  freeform single-quest mode — surfaced in the **Create** screen (`/app/create`).
- Renders `SidequestItem` with `questDescription`, `estimatedActivityMinutes`
  (formatted to "1 hr 15 min"), `categories[]`, and the rich
  `locationInformation` (`distanceMiles`, `transportationOptions`).
- Distance and travel times are computed server-side; the client only formats
  them. The onboarding city is geocoded (Open-Meteo, no key) so
  `cityLatitude/cityLongitude` are sent and the backend can do that math.

## iOS → Web adaptations

| iOS | Web |
| --- | --- |
| SwiftData | Zustand + localStorage; photos in IndexedDB |
| MapKit inline preview | react-leaflet map; tap opens `googleMapsURL` |
| Tab bar | Desktop left sidebar; mobile bottom tab bar (Home / Create / History / Settings; Dev tucked in Settings) |
| Tinder swipe | Adaptive Home: a single focused card, tap-through the curated trio (←/→ keys, pager dots) → pick one to commit |
| Haptics | Subtle scale/motion + color feedback |
| Bundled placeholder images | Warm Igneous gradients per quest |
| `generateGetStartedGuide` (not built) | **Mocked client-side** in `lib/getStarted.ts` |

## Project layout

```
frontend/src/
  App.tsx                 # router
  types.ts                # backend types mirrored + web Quest model
  lib/                    # firebase, api (+mock), geocode, photos, device, format, theme, collage
  store/useAppStore.ts    # profile, quests, batch actions + selectors
  data/                   # onboarding options, placeholders, mock fixtures
  components/             # UI primitives, QuestMap, HeroVisual, nav, etc.
  routes/
    Landing.tsx
    onboarding/Onboarding.tsx
    app/{AppLayout,Home,Create,Completion,History,CompletedDetail,Settings,Dev}.tsx
```

## Quest lifecycle (two-option model)

- A curated batch is **3** quests, all `available`. **Home is adaptive**: with
  no committed quest it shows a single focused card you tap through (←/→, pager
  dots); picking one sets it `active`. Only one quest is `active` at a time —
  committing to another swaps the previous one back to `available`.
- **Create** (`/app/create`) is the describe-your-own compose screen: a freeform
  prompt → `generateUserDescribedSidequest` → one result → "Start this quest"
  makes it the `active` quest (`source: "described"`, shown with a "Your own
  idea" badge on Home).
- "New trio" re-runs `generateCuratedSidequests`, replacing the `available` set
  (keeps `active` + history). Home auto-curates a fresh trio whenever nothing is
  `available` and nothing is `active`, showing the "curating" state past a moment.
- Completing the `active` quest moves it to `completed` (History).
- Store selectors: `selectActiveQuest`, `selectCurated` (the available trio),
  `selectCompleted`. The old `skipped` status and Tinder swipe deck are removed.

## Notes

- The "Get Started" guide is mocked. To switch to the real backend, replace the
  body of `lib/getStarted.ts` with an `httpsCallable("generateGetStartedGuide")`
  call returning `string[]`.
- Swap captions/collage are generated locally (canvas) — no API calls.
