# Horizon Backend Migration Guide: Guided UI Pivot

_Context for the Backend AI Agent: We have decided to pivot the Horizon app onboarding from a conversational AI chat to a structured, multi-step Guided UI flow. This document outlines the required changes to the Firebase Cloud Functions and data contracts._

## 1. Endpoints to Remove

- **onboardingChat**: Delete this Cloud Function entirely.
- **Progressive Summarization**: We are no longer using progressive summarization to build a user profile. The iOS app will now collect the user profile locally via a UI form and send the fully-structured profile directly to the generation endpoints.

## 2. Updated Data Model (`UserProfile`)

The backend will now receive a much richer, highly-structured `UserProfile` object. The `onboardingSummary` field has been removed.

The new `UserProfile` payload looks like this:

```json
{
  "interests": ["string"], // e.g., ["Art", "Coffee"]
  "growthAreas": ["string"], // e.g., ["Meeting strangers"]
  "vibe": ["string"], // e.g., ["Solo", "High Energy"]
  "experimentationLevel": 1, // Int (1-5 slider)
  "budget": ["string"], // e.g., ["Free", "Moderate"]
  "transportation": ["string"], // e.g., ["Walking", "Transit"]
  "locationPreferences": ["string"], // e.g., ["Downtown", "Nature"]
  "additionalContext": "string or null", // Any free-text constraints
  "city": "string" // The user's anchor city
}
```

## 3. Updates to `generateSidequests`

This function is still responsible for generating a batch of 10 quests, but it must be updated to consume the new `UserProfile` object.

**New Request Payload:**

```json
{
  "profile": { ... }, // See UserProfile schema above
  "count": 10,
  "excludeTitles": ["string"]
}
```

**New Gemini Prompting Strategy:**
The system prompt must be updated to utilize the new structured data:

- Ensure `budget`, `transportation`, and `additionalContext` act as **strict constraints** (e.g., if transportation is "walking", do not generate quests requiring a car).
- The `experimentationLevel` (1-5) is a critical new lever. It dictates how much Gemini should deviate from the user's explicit preferences. A low value means stick strictly to `interests` and `vibe`. A high value means intentionally inject "wildcard" quests that push the user outside their stated preferences.

## 4. Updates to `generateGetStartedGuide`

This function now accepts a subset of the profile rather than an `onboardingSummary` string.

**New Request Payload:**

```json
{
  "sidequest": {
    "title": "string",
    "description": "string",
    "categories": ["string"]
  },
  "profile": {
    "interests": ["string"],
    "growthAreas": ["string"],
    "additionalContext": "string or null"
  }
}
```

## 5. Rate Limiting Adjustments

Update the rate limit enforcement to match the new architecture:

- `generateSidequests`: 5 calls per hour
- `generateGetStartedGuide`: 10 calls per hour
- (Remove the limits for the deleted `onboardingChat` function).

## Summary of Next Steps for Backend Agent

1. docs/backend-guide is the only documentation that is up to date with this migration plan. All other docs in this folder are outdated. Your job is to update them (including the roadmap and all other docs) to achieve the above changes
2. do not begin coding or anything in any way right now

- note: delete this file backend-migration-guide.md when you're done
