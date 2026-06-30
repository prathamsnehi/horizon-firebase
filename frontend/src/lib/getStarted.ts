import type { Quest, UserProfile } from "../types";

/**
 * Client-side mock of the (not-yet-implemented) `generateGetStartedGuide`
 * Cloud Function. Produces plausible, personalized-feeling steps so the
 * Home view's "Get Started" experience is complete in the prototype.
 *
 * To switch to the real backend later, replace this with an httpsCallable
 * call and keep the same return shape (string[]).
 */
export function generateGetStartedSteps(
  quest: Quest,
  profile: UserProfile | null
): string[] {
  const loc = quest.locationInformation;
  const place = loc?.name;
  const growth = profile?.growthAreas?.[0];
  const steps: string[] = [];

  steps.push(
    place
      ? `Set aside about ${quest.estimatedActivityMinutes} minutes and head toward ${place}${
          loc?.address ? ` (${loc.address})` : ""
        }.`
      : `Carve out about ${quest.estimatedActivityMinutes} minutes where you won't be interrupted.`
  );

  if (loc?.transportationOptions?.length) {
    const rec =
      loc.transportationOptions.find((o) => o.isRecommended) ??
      loc.transportationOptions[0];
    steps.push(
      `Plan your trip — ${rec.mode}${
        rec.estimatedTravelMinutes
          ? ` is about ${rec.estimatedTravelMinutes} minutes from you`
          : ""
      }. Check it's open before you leave.`
    );
  }

  steps.push(
    `Drop your usual routine for a moment and approach this with curiosity — the goal is the experience, not perfection.`
  );

  if (growth) {
    steps.push(
      `Lean into your goal of "${growth}". Notice one small moment where you stepped outside your comfort zone.`
    );
  }

  steps.push(
    `When you're done, snap a photo and jot a quick reflection so you can look back on it later.`
  );

  return steps;
}
