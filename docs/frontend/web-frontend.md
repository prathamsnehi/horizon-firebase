# Horizon Web Frontend

A desktop-first (mobile-friendly) web prototype of the Horizon app, living in
`/frontend`. It drives the deployed `generateSidequests` Cloud Function and
adapts the iOS flows (Onboarding → Home → Discover → Completion → History) and
the "Igneous Core" design system to the web.

> This is a prototyping surface. The real product home is the iOS/SwiftUI app.
> There is **no auth** — all user state lives locally in the browser, mirroring
> the app's SwiftData/local-only model.

## Stack

- **Vite + React + TypeScript**
- **React Router** (`/` landing, `/app/*` product routes)
- **Tailwind CSS** with Igneous Core tokens as CSS variables (light/dark)
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

- Sends `SidequestRequest { profile, count: 10, excludeTitles, deviceId }`.
  `deviceId` is a stable UUID in localStorage (stands in for the iOS vendor ID).
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
| Tab bar | Desktop left sidebar; mobile bottom tab bar |
| Tinder swipe | Framer-Motion drag + Skip/Accept buttons + ←/→ keys |
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
  components/             # UI primitives, SwipeCard, QuestMap, HeroVisual, nav, etc.
  routes/
    Landing.tsx
    onboarding/Onboarding.tsx
    app/{AppLayout,Home,Discover,Completion,History,CompletedDetail}.tsx
```

## Batch lifecycle (matches the app spec)

- A batch is 10 quests, all `available`. Swipe left → `skipped`, right →
  `active` (only one active at a time; accepting another swaps the old one back
  to `available`).
- When every card is skipped, Discover shows a grid to pick from.
- "New batch" appears after ≥1 completion; it clears remaining
  `available`/`skipped` quests and generates 10 fresh (keeps active + history).
- When the deck is fully exhausted, Discover auto-generates a new batch and
  shows the "curating" state if it takes more than a moment.

## Notes

- The "Get Started" guide is mocked. To switch to the real backend, replace the
  body of `lib/getStarted.ts` with an `httpsCallable("generateGetStartedGuide")`
  call returning `string[]`.
- Swap captions/collage are generated locally (canvas) — no API calls.
