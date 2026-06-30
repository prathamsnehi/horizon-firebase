/**
 * Bundled placeholder hero visuals for non-location quests (the web
 * equivalent of the app's bundled placeholder images). Warm gradients in
 * the Igneous Core spirit, picked deterministically per quest.
 */
export const PLACEHOLDER_GRADIENTS: string[] = [
  "linear-gradient(135deg, #FFB693 0%, #F0966E 100%)",
  "linear-gradient(135deg, #FFCBA8 0%, #E07A5C 100%)",
  "linear-gradient(135deg, #F2A65A 0%, #C44E4E 100%)",
  "linear-gradient(135deg, #FFD6A5 0%, #FFB693 60%, #B97A56 100%)",
  "linear-gradient(135deg, #E8A87C 0%, #85586F 100%)",
  "linear-gradient(135deg, #FFB693 0%, #7AA274 100%)",
  "linear-gradient(135deg, #F6C28B 0%, #C97B63 50%, #6D4C5A 100%)",
  "linear-gradient(135deg, #FFC9A3 0%, #D68A60 100%)",
];

export function placeholderGradient(index: number): string {
  return PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];
}

export function placeholderIndexFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % PLACEHOLDER_GRADIENTS.length;
}
