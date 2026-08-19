/**
 * The public page. Deliberately identical to the static page it replaced —
 * black ground, one breathing line of text, nothing to load.
 *
 * Nothing here may import Firebase, directly or transitively: keeping this route
 * free of it is what lets Vite split the admin bundle away from the page every
 * visitor actually sees.
 */
export default function ComingSoon() {
  return (
    <main className="flex min-h-full items-center justify-center bg-black p-6 text-center">
      <h1 className="coming-soon m-0 text-[clamp(1.5rem,6vw,3rem)] font-medium tracking-[0.02em] text-white/90">
        coming very soon
      </h1>
    </main>
  );
}
