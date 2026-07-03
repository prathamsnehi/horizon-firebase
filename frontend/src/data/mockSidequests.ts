import type { SidequestItem } from "../types";

/**
 * Local fixtures used when VITE_USE_MOCK=true (or Firebase isn't configured).
 * Photos use picsum.photos so location cards render real images offline.
 * Shape matches the real `generateCuratedSidequests` response exactly.
 */
export const MOCK_SIDEQUESTS: SidequestItem[] = [
  {
    title: "Sunrise at the overlook",
    questDescription:
      "Wake before dawn and hike up to a city overlook to watch the sun break the horizon. Bring a thermos and sit with the quiet before the day starts.",
    difficulty: "moderate",
    estimatedActivityMinutes: 90,
    categories: ["adventure", "mindfulness", "nature"],
    locationInformation: {
      name: "Bernal Heights Park",
      address: "Bernal Heights Blvd, San Francisco, CA",
      locationDescription:
        "A grassy hilltop park with sweeping 360° views over the city skyline and bay.",
      latitude: 37.7434,
      longitude: -122.4159,
      photoURL: "https://picsum.photos/seed/overlook/800/600",
      googleMapsURL: "https://maps.google.com/?q=Bernal+Heights+Park",
      distanceMiles: 2.4,
      transportationOptions: [
        { mode: "walking", estimatedTravelMinutes: 41, isRecommended: false },
        { mode: "bike", estimatedTravelMinutes: 14, isRecommended: true },
        { mode: "car", estimatedTravelMinutes: 9, isRecommended: false },
      ],
    },
  },
  {
    title: "Order in another language",
    questDescription:
      "Find a café or restaurant and order entirely in a language you're learning (or have never tried). Embrace the awkwardness — the staff will love it.",
    difficulty: "easy",
    estimatedActivityMinutes: 30,
    categories: ["connection", "learning", "spontaneity"],
  },
  {
    title: "The independent bookstore crawl",
    questDescription:
      "Visit a local independent bookstore and ask a bookseller for a personal recommendation. Buy it, then read the first chapter on a bench nearby.",
    difficulty: "easy",
    estimatedActivityMinutes: 60,
    categories: ["creativity", "learning"],
    locationInformation: {
      name: "City Lights Booksellers",
      address: "261 Columbus Ave, San Francisco, CA",
      locationDescription:
        "Historic independent bookstore and publisher, a landmark of the Beat movement.",
      latitude: 37.7976,
      longitude: -122.4065,
      photoURL: "https://picsum.photos/seed/bookstore/800/600",
      googleMapsURL: "https://maps.google.com/?q=City+Lights+Booksellers",
      distanceMiles: 1.1,
      transportationOptions: [
        { mode: "walking", estimatedTravelMinutes: 22, isRecommended: true },
        { mode: "publicTransport", estimatedTravelMinutes: 12, isRecommended: false },
      ],
    },
  },
  {
    title: "Cook a dish from a stranger's country",
    questDescription:
      "Pick a country you've never cooked from, find a traditional recipe, shop for the ingredients, and make it tonight. Plate it like you mean it.",
    difficulty: "moderate",
    estimatedActivityMinutes: 120,
    categories: ["creativity", "growth"],
  },
  {
    title: "Golden hour photo walk",
    questDescription:
      "Spend the last hour of daylight wandering a waterfront with your phone or camera. Capture ten frames you'd actually print.",
    difficulty: "easy",
    estimatedActivityMinutes: 60,
    categories: ["creativity", "nature"],
    locationInformation: {
      name: "Crissy Field",
      address: "1199 East Beach, San Francisco, CA",
      locationDescription:
        "A former airfield turned shoreline park with views of the Golden Gate Bridge.",
      latitude: 37.8042,
      longitude: -122.4654,
      photoURL: "https://picsum.photos/seed/crissy/800/600",
      googleMapsURL: "https://maps.google.com/?q=Crissy+Field",
      distanceMiles: 3.8,
      transportationOptions: [
        { mode: "bike", estimatedTravelMinutes: 22, isRecommended: true },
        { mode: "car", estimatedTravelMinutes: 14, isRecommended: false },
        { mode: "rideshare", estimatedTravelMinutes: 14, isRecommended: false },
      ],
    },
  },
  {
    title: "Write a letter, mail it",
    questDescription:
      "Handwrite a letter to someone who shaped you and actually put it in the mail. No texts, no email — ink and a stamp.",
    difficulty: "easy",
    estimatedActivityMinutes: 45,
    categories: ["connection", "mindfulness"],
  },
  {
    title: "Open mic, front row",
    questDescription:
      "Find a local open mic night and go alone. Sit up front, and talk to at least one performer after their set.",
    difficulty: "hard",
    estimatedActivityMinutes: 120,
    categories: ["connection", "courage"],
    locationInformation: {
      name: "The Make-Out Room",
      address: "3225 22nd St, San Francisco, CA",
      locationDescription:
        "A beloved Mission District music and events venue known for its eclectic lineups.",
      latitude: 37.7553,
      longitude: -122.4189,
      photoURL: "https://picsum.photos/seed/openmic/800/600",
      googleMapsURL: "https://maps.google.com/?q=The+Make-Out+Room",
      distanceMiles: 2.0,
      transportationOptions: [
        { mode: "publicTransport", estimatedTravelMinutes: 18, isRecommended: true },
        { mode: "rideshare", estimatedTravelMinutes: 11, isRecommended: false },
      ],
    },
  },
  {
    title: "Digital sunset",
    questDescription:
      "Go fully offline from sunset to sunrise. No screens after dark — read, cook, or just sit with your thoughts. Notice what fills the space.",
    difficulty: "moderate",
    estimatedActivityMinutes: 180,
    categories: ["mindfulness", "growth"],
  },
  {
    title: "Talk to a stranger",
    questDescription:
      "Strike up a genuine conversation with someone new — in a queue, a park, a café. Ask one question you're actually curious about.",
    difficulty: "hard",
    estimatedActivityMinutes: 20,
    categories: ["connection", "courage"],
  },
  {
    title: "Midnight city wander",
    questDescription:
      "After midnight, walk a safe, well-lit route through a part of the city you've never explored on foot. Let the empty streets surprise you.",
    difficulty: "extreme",
    estimatedActivityMinutes: 90,
    categories: ["adventure", "spontaneity"],
    locationInformation: {
      name: "The Embarcadero",
      address: "The Embarcadero, San Francisco, CA",
      locationDescription:
        "A scenic waterfront promenade running along the eastern edge of the city.",
      latitude: 37.7993,
      longitude: -122.3972,
      photoURL: "https://picsum.photos/seed/embarcadero/800/600",
      googleMapsURL: "https://maps.google.com/?q=The+Embarcadero+San+Francisco",
      distanceMiles: 1.6,
      transportationOptions: [
        { mode: "walking", estimatedTravelMinutes: 32, isRecommended: false },
        { mode: "rideshare", estimatedTravelMinutes: 9, isRecommended: true },
      ],
    },
  },
];
