import type { TransportationMode } from "../types";

export interface PillOption<T extends string = string> {
  value: T;
  label: string;
  emoji?: string;
}

/**
 * Onboarding choices. Pill `value`s are the strings sent to the backend
 * (free-form for interests/growthAreas/vibe/locationPrefs; the backend
 * prompt consumes them as plain context). Enum-bound fields
 * (transportation) use the exact backend enum values.
 */

export const INTEREST_OPTIONS: PillOption[] = [
  { value: "Hiking", label: "Hiking", emoji: "🥾" },
  { value: "Coffee shops", label: "Coffee shops", emoji: "☕️" },
  { value: "Street art", label: "Street art", emoji: "🎨" },
  { value: "Live music", label: "Live music", emoji: "🎶" },
  { value: "Food & cooking", label: "Food & cooking", emoji: "🍜" },
  { value: "Photography", label: "Photography", emoji: "📷" },
  { value: "Reading", label: "Reading", emoji: "📚" },
  { value: "Fitness", label: "Fitness", emoji: "🏃" },
  { value: "History", label: "History", emoji: "🏛️" },
  { value: "Nature", label: "Nature", emoji: "🌿" },
  { value: "Nightlife", label: "Nightlife", emoji: "🌃" },
  { value: "Volunteering", label: "Volunteering", emoji: "🤝" },
  { value: "Gaming", label: "Gaming", emoji: "🎮" },
  { value: "Markets", label: "Markets", emoji: "🛍️" },
  { value: "Cycling", label: "Cycling", emoji: "🚲" },
];

export const GROWTH_OPTIONS: PillOption[] = [
  { value: "Meeting new people", label: "Meeting new people", emoji: "👋" },
  { value: "Trying new foods", label: "Trying new foods", emoji: "🥢" },
  { value: "Being more spontaneous", label: "Being more spontaneous", emoji: "✨" },
  { value: "Public speaking", label: "Public speaking", emoji: "🎤" },
  { value: "Getting outdoors more", label: "Getting outdoors more", emoji: "⛰️" },
  { value: "Creative confidence", label: "Creative confidence", emoji: "🎭" },
  { value: "Mindfulness", label: "Mindfulness", emoji: "🧘" },
  { value: "Physical challenge", label: "Physical challenge", emoji: "💪" },
  { value: "Learning a skill", label: "Learning a skill", emoji: "🧠" },
  { value: "Slowing down", label: "Slowing down", emoji: "🌙" },
];

// Mirrors QuestVibe in docs/frontend/swift-models.md
export const VIBE_OPTIONS: PillOption[] = [
  { value: "Solo", label: "Solo", emoji: "🧍" },
  { value: "Social", label: "Social", emoji: "🫂" },
  { value: "Chill", label: "Chill", emoji: "😌" },
  { value: "Adventurous", label: "Adventurous", emoji: "🧭" },
  { value: "Creative", label: "Creative", emoji: "🎨" },
  { value: "Spontaneous", label: "Spontaneous", emoji: "🎲" },
  { value: "Chaotic", label: "Chaotic", emoji: "🌀" },
  { value: "Night owl", label: "Night owl", emoji: "🦉" },
  { value: "Romantic", label: "Romantic", emoji: "💞" },
  { value: "Quirky", label: "Quirky", emoji: "🤪" },
];

// Mirrors BudgetLevel
export const BUDGET_OPTIONS: PillOption[] = [
  { value: "Free", label: "Free", emoji: "🆓" },
  { value: "Cheap", label: "Cheap", emoji: "💸" },
  { value: "Moderate", label: "Moderate", emoji: "💵" },
  { value: "Splurge", label: "Splurge", emoji: "💎" },
];

// Mirrors TransportationMode enum exactly (values sent to backend)
export const TRANSPORT_OPTIONS: PillOption<TransportationMode>[] = [
  { value: "walking", label: "Walking", emoji: "🚶" },
  { value: "publicTransport", label: "Public transit", emoji: "🚇" },
  { value: "car", label: "Car", emoji: "🚗" },
  { value: "bike", label: "Bike", emoji: "🚲" },
  { value: "rideshare", label: "Rideshare", emoji: "🚕" },
];

// Mirrors LocationPreference
export const LOCATION_PREF_OPTIONS: PillOption[] = [
  { value: "Downtown", label: "Downtown", emoji: "🏙️" },
  { value: "Neighborhood", label: "Neighborhood", emoji: "🏘️" },
  { value: "Nature", label: "Nature", emoji: "🌲" },
  { value: "Indoors", label: "Indoors", emoji: "🏠" },
  { value: "Waterfront", label: "Waterfront", emoji: "🌊" },
  { value: "Anywhere", label: "Anywhere", emoji: "🗺️" },
];
