/**
 * Pre-generated quests for the interactive demo on `/`. Each is served as if
 * Horizon generated it live. Venues are invented but plausible; cities are real —
 * deliberately no named businesses, so nothing misrepresents a real place.
 */
export interface DemoQuest {
  fear: string; // the "thing you keep going around"
  task: string; // the quest itself
  venue: string; // an invented, generic place
  city: string; // a real city
  distance: string;
  openUntil: string;
  note: string;
}

export const QUESTS: DemoQuest[] = [
  {
    fear: "eating alone",
    task: "Eat a full meal alone at the counter",
    venue: "a tiny ramen bar",
    city: "Osaka, Japan",
    distance: "0.4 mi · 9 min",
    openUntil: "22:30",
    note: "Sit at the counter, not a table. Order the set and stay for all of it.",
  },
  {
    fear: "cold water",
    task: "Get in the sea past your shoulders",
    venue: "a quiet cove",
    city: "Cascais, Portugal",
    distance: "0.8 mi · 15 min",
    openUntil: "sunset",
    note: "13°C today. Ten seconds under counts. Bring a towel, not a plan.",
  },
  {
    fear: "speaking up",
    task: "Ask the bartender what they'd actually order",
    venue: "an old corner bar",
    city: "Buenos Aires, Argentina",
    distance: "0.6 mi · 12 min",
    openUntil: "01:00",
    note: "Then order it, whatever it is. No editing your choice afterward.",
  },
  {
    fear: "being seen",
    task: "Read a book in a busy café for an hour",
    venue: "a window-seat café",
    city: "Vienna, Austria",
    distance: "0.3 mi · 7 min",
    openUntil: "20:00",
    note: "Take the most visible seat. Phone stays in your bag the whole time.",
  },
  {
    fear: "strangers",
    task: "Ask someone for a genuine recommendation",
    venue: "a backstreet record shop",
    city: "Berlin, Germany",
    distance: "0.9 mi · 17 min",
    openUntil: "19:00",
    note: "Not directions — ask what they love. Buy the thing they light up about.",
  },
  {
    fear: "heights",
    task: "Take the lookout stairs all the way to the top",
    venue: "a hillside viewpoint",
    city: "Lisbon, Portugal",
    distance: "1.1 mi · 21 min",
    openUntil: "sunset",
    note: "Stop at the railing. Look out, not down. Stay one full minute.",
  },
  {
    fear: "dancing",
    task: "Stay for one whole song where people can see you",
    venue: "a small salsa hall",
    city: "Cali, Colombia",
    distance: "0.7 mi · 14 min",
    openUntil: "02:00",
    note: "You don't have to be good. You have to still be there when it ends.",
  },
  {
    fear: "being alone with yourself",
    task: "Watch the sunrise somewhere new, alone",
    venue: "a harbour wall",
    city: "Reykjavík, Iceland",
    distance: "1.4 mi · 26 min",
    openUntil: "always open",
    note: "No music, no calls. Just you and the light coming up.",
  },
  {
    fear: "singing",
    task: "Put your name down for exactly one song",
    venue: "a backstreet karaoke room",
    city: "Seoul, South Korea",
    distance: "0.5 mi · 10 min",
    openUntil: "03:00",
    note: "Pick something you actually love. Ballads count. Finish it.",
  },
  {
    fear: "slowing down",
    task: "Sit with a coffee and no phone for 20 minutes",
    venue: "a garden teahouse",
    city: "Marrakech, Morocco",
    distance: "0.6 mi · 12 min",
    openUntil: "23:00",
    note: "Leave the phone face-down and out of reach. Just watch the room.",
  },
  {
    fear: "asking for things",
    task: "Order entirely in the local language",
    venue: "a morning market stall",
    city: "Oaxaca, Mexico",
    distance: "0.5 mi · 11 min",
    openUntil: "14:00",
    note: "Rehearse one sentence on the walk over. Fumbling still counts.",
  },
  {
    fear: "going out solo",
    task: "See a film by yourself, front row",
    venue: "a single-screen cinema",
    city: "Melbourne, Australia",
    distance: "0.8 mi · 16 min",
    openUntil: "23:45",
    note: "Buy one ticket. Sit close. Stay through the credits.",
  },
];

/** Slot-machine strings for the "scanning places" beat of the generation —
 *  real cities around the world, with flags, to sell the "anywhere" premise. */
export const PLACE_TICKER: string[] = [
  "a tiny ramen bar · Osaka 🇯🇵",
  "a quiet cove · Cascais 🇵🇹",
  "an old corner bar · Buenos Aires 🇦🇷",
  "a window-seat café · Vienna 🇦🇹",
  "a backstreet record shop · Berlin 🇩🇪",
  "a hillside viewpoint · Lisbon 🇵🇹",
  "a small salsa hall · Cali 🇨🇴",
  "a harbour wall · Reykjavík 🇮🇸",
  "a karaoke room · Seoul 🇰🇷",
  "a garden teahouse · Marrakech 🇲🇦",
  "a morning market · Oaxaca 🇲🇽",
  "a single-screen cinema · Melbourne 🇦🇺",
  "a rooftop bar · Bangkok 🇹🇭",
  "a canal-side bench · Amsterdam 🇳🇱",
  "a night market · Taipei 🇹🇼",
  "a jazz basement · New Orleans 🇺🇸",
  "a clifftop path · Galway 🇮🇪",
  "a bathhouse · Budapest 🇭🇺",
];
