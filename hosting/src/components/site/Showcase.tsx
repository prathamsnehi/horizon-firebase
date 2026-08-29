import { color } from "@/lib/tokens";
import { PhoneShowcase } from "./showcase/PhoneShowcase";

/**
 * The showcase: a scroll-driven, pinned walkthrough of the real app (see
 * PhoneShowcase). The section is tall; the phone stays pinned and scroll steps
 * through the clips at the visitor's pace. Firebase-free; id="steps" keeps the
 * header/nav anchor working.
 */
export default function Showcase() {
  return (
    <section id="steps" style={{ background: color.paper }}>
      <PhoneShowcase />
    </section>
  );
}
