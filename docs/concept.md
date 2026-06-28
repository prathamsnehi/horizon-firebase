# Horizon — Concept

## What is Horizon?

Horizon is a personal growth app that generates AI-powered real-world "sidequests" — challenges designed to push users out of their comfort zones and help them experience the world more fully. It's not a social media platform. It's a private, calm space where users discover curated challenges through a swipe-to-choose interface, complete them at their own pace, and document their experiences through photos and journal entries.

## Core Philosophy

- **Growth through action** — not content consumption, not social comparison
- **One quest at a time** — focus on a single sidequest rather than juggling multiple. Depth over breadth.
- **Discovery through choice** — a swipe interface gives the user agency in selecting their next challenge from a curated batch, rather than being assigned one
- **Minimal and calm** — the app gets out of the way and lets the experience speak for itself
- **Shareable, not social** — no feeds, no followers, no likes inside the app. But users can share their completed quests outward to their own social media as beautiful collages

## User Flow

### 1. Onboarding (Guided UI)

A warm, multi-step Guided UI onboarding that learns about the user. The user fills out a structured form that establishes their baseline profile. Questions explore things like:

- Interests (e.g., Art, Coffee, Hiking)
- Growth areas (where they want to push themselves)
- Preferred vibe (solo vs social)
- Experimentation level (how much they want to step outside their comfort zone)
- Budget & transportation constraints
- What city they are based in

The onboarding is **mandatory** on first launch — it cannot be skipped, since the AI needs profile data to generate relevant quests. It establishes the user's baseline profile (including their city), which informs sidequest generation. The city enables location-aware sidequests with specific places nearby.

Users can re-take the onboarding at any time to refresh their profile. When re-taking, the user chooses whether to clear their current quest batch or keep it. Completed quests are never touched. Some profile fields (like city) can also be updated directly from Settings without re-taking onboarding.

### 2. Discovering Sidequests (Swipe Interface)

After onboarding, the app generates a **batch of 10 sidequests** tailored to the user's profile. The user discovers and chooses their next quest through a **Tinder-style swipe interface** on the Discover tab:

- **Swipe left** — skip this quest, move to the next card
- **Swipe right** — accept this quest, it becomes the user's active sidequest

The user sees one card at a time, each showing the quest's title, hero image, difficulty, estimated time, and categories. This makes choosing feel fun and low-pressure rather than overwhelming.

**Swipe limit:** The user has **10 cards** in their batch — that's it. They can't generate more until they complete a quest. If they swipe left on all 10, they see a list of all 10 previously skipped quests and must pick one from that list. This prevents endless swiping and keeps backend costs controlled.

**Batch persistence:** The batch of 10 **persists** until the user explicitly chooses to regenerate. Completing a quest does not automatically clear the batch — the remaining quests stay available for future selection. The user can keep picking from their current batch until it runs out, or choose to generate a fresh batch of 10 at any time after completing a quest.

**Regeneration:** After completing a quest, a **"Generate new batch"** option appears in the Discover tab. This is the user's choice — they can either pick their next quest from the remaining cards, or regenerate for a completely fresh set of 10. Regenerating clears all remaining `.available` and `.skipped` quests and replaces them with new ones. If the app needs to freshly curate these quests (e.g., if preferences changed or no pre-generated batch is ready), it may take a few seconds. In this case, the app displays a "curating" state: *"New sidequests are being curated for you, please check back shortly."*

### 3. Sidequest Structure

Each sidequest includes:

- **Title** — short, compelling name
- **Description** — what the quest is about and why it's worth doing
- **Difficulty rating** — how challenging this quest is
- **Estimated time** — rough time commitment
- **Categories** — classification labels (e.g., adventure, creativity, connection, mindfulness)
- **Location** (optional) — a specific address for location-based quests, shown on an inline map via MapKit in the detail view. Not all quests have a location.
- **Hero image** — for location-based quests, a photo of the place sourced from the Google Maps Places API (resolved server-side by the Cloud Function). For non-location quests, a pre-loaded placeholder image bundled with the app. Displayed prominently on both the swipe card and the detail view.
- **"Get Started" button** — on-demand AI generation of a step-by-step guide for how to approach and complete the quest

### 4. Active Sidequest (Home Tab)

The user has **one active sidequest at a time**. The Home tab is entirely dedicated to this single quest, giving it space to breathe with rich detail:

- Full hero image
- Complete description
- Inline map for location-based quests
- Get Started guide
- Completion action

Having just one active quest keeps the experience focused. The user isn't split across multiple commitments — they pour themselves into one thing.

**Swapping:** If the user changes their mind about their active quest, they can go back to the Discover tab and pick a different one from the same batch of 10. The old active quest returns to the available pool. No new quests are generated — they choose from their existing batch.

### 5. Completing a Sidequest

When a user completes a sidequest:

- Upload **one or more photos** as proof / memories (required — at least one photo needed to complete)
- Write a **journal entry** reflecting on the experience (optional but encouraged)
- The quest moves from the Home tab to the completed history
- The remaining quests in the batch **stay available** — the user can pick their next quest from the same batch
- A **"Generate new batch"** option appears in the Discover tab if the user wants fresh options instead

Completion is **binary** — done or not done. No partial completion.

Completed quests are **editable** — the user can go back and add more photos, edit their journal entry, or update anything at any time. No locking.

### 6. App Tabs

**Tab 1 — Home (Active Quest)**
Dedicated to the user's single active sidequest. Shows the full quest detail with hero image, description, map, Get Started guide, and completion action. When no quest is active, shows an empty state directing the user to the Discover tab to choose one.

**Tab 2 — Discover (Swipe Interface)**
The swipe card interface for choosing the next sidequest. One card at a time, swipe left to skip, swipe right to accept. Shows remaining card count. When all cards have been skipped, switches to a list/grid view of all 10 for manual selection.

**Tab 3 — History (Completed Quests)**
A simple chronological view of all completed sidequests with their photos and journal entries. A place for the user to look back and appreciate how far they've come.

### 7. Sharing

After completing a sidequest, the user can share it externally:

- The app **auto-generates a collage** from the photos they uploaded
- A **template caption** accompanies the collage
- Includes a **link to the Horizon app**
- Designed for posting on the user's own social media (Instagram, Twitter, etc.)
- This doubles as the **organic marketing channel** for the app

No in-app social features. No feeds, followers, or comments.

## What Horizon is NOT

- Not a social media app — no in-app social graph
- Not a habit tracker — quests are unique experiences, not recurring habits
- Not a to-do list — the AI generates the quests, not the user
- Not a fitness app — quests span all dimensions of life experience

## Technical Constraints

- **iPhone only** (initial release)
- **No user accounts or authentication** in v1 — all data stored locally on device
- **Offline support** for already-generated sidequests (viewing, completing, journaling)
- **Online required** for generating new sidequest batches and "Get Started" guides
- **Firebase Cloud Functions** as the backend for AI sidequest generation — the app sends user profile data, receives structured sidequest data back. The specific AI model behind the Cloud Function is a backend concern, not an app concern.
