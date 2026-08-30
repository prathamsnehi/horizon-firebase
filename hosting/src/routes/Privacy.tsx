import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { color, font, layout } from "../lib/tokens";

/**
 * Privacy policy at `/privacy` — App Store review requires a reachable policy URL.
 *
 * Like `/`, this route is deliberately Firebase-free so it stays in the marketing
 * chunk. It is plain prose on the site's paper palette; no motion, no smooth
 * scroll, nothing to distract from a document people skim.
 *
 * The facts below were confirmed with the founder and checked against the backend:
 * anonymous Firebase auth (no email/password); the reflection log never leaves the
 * device; the durable record of a generation (generation_samples) carries NO uid
 * and coarsens location to city level; the only uid-keyed documents are a rate-limit
 * stamp and a pre-generated batch cache, both self-expiring; no analytics or crash
 * SDKs ship in the app.
 * The website keeps aggregate daily counters only (see "The website" below). If
 * any of that changes, this page must change with it.
 */
const UPDATED = "August 2026";
const CONTACT = "contact@prathamsnehi.com";

const h2: React.CSSProperties = {
  fontFamily: font.display,
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "-.01em",
  color: color.ink,
  margin: "44px 0 12px",
};
const p: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 16,
  lineHeight: 1.7,
  color: color.inkBody,
};
const li: React.CSSProperties = { ...p, margin: "0 0 10px" };

export default function Privacy() {
  useLayoutEffect(() => {
    const b = document.body;
    const prev = b.getAttribute("style");
    b.style.background = color.paper;
    b.style.color = color.ink;
    b.style.fontFamily = font.body;
    document.title = "Privacy — Horizon";
    return () => {
      if (prev === null) b.removeAttribute("style");
      else b.setAttribute("style", prev);
    };
  }, []);

  return (
    <div className="hz-site" style={{ background: color.paper, minHeight: "100%" }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: `clamp(48px,8vw,96px) ${layout.gutter} clamp(64px,10vw,120px)`,
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            marginBottom: 40,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 11,
              background: color.peach,
              borderRadius: "22px 22px 0 0",
              display: "block",
            }}
          />
          <span
            style={{
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-.01em",
              textTransform: "lowercase",
              color: color.ink,
            }}
          >
            Horizon
          </span>
        </Link>

        <h1
          style={{
            fontFamily: font.display,
            fontSize: "clamp(34px,5vw,48px)",
            fontWeight: 800,
            letterSpacing: "-.03em",
            lineHeight: 1.05,
            textTransform: "lowercase",
            color: color.ink,
            margin: "0 0 12px",
          }}
        >
          Privacy
        </h1>
        <p style={{ ...p, color: color.inkFaint, marginBottom: 36 }}>
          Last updated {UPDATED}
        </p>

        <p style={p}>
          Horizon is built to need as little about you as possible. There are no
          accounts to create, no email address to hand over, and nothing you write
          in your log ever leaves your phone. This page explains exactly what the
          app does handle, and why.
        </p>

        <h2 style={h2}>What we collect</h2>
        <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
          <li style={li}>
            <strong>What you tell us you avoid.</strong> The hesitations you pick
            during onboarding, your preferences, and any quest you describe
            yourself are sent to our servers so quests can be generated.
          </li>
          <li style={li}>
            <strong>An approximate location.</strong> Used to find real places near
            you. Before anything is written down it is reduced to a city-level
            approximation &mdash; enough to know roughly where to look, not enough
            to know where you are. You can decline the permission; the app then
            can&rsquo;t suggest nearby places.
          </li>
        </ul>
        <p style={p}>
          Here is the part that matters: <strong>the record we keep of all this
          carries no identifier at all.</strong> It holds the hesitations, the
          approximate area, and the quests that came back &mdash; and nothing that
          says who asked. There is no account name, no device ID and no user ID
          attached, so those records cannot be linked to you, and they cannot be
          linked to each other either. We could not reconstruct one person&rsquo;s
          history if we wanted to.
        </p>
        <p style={p}>
          The app does sign in anonymously through Firebase Authentication, which
          gives your install a random ID. It is used for two throwaway jobs: making
          sure one install can&rsquo;t ask for quests endlessly, and holding a batch
          of quests prepared in advance so the app feels instant. Both of those
          records expire on their own, and neither is joined to the permanent record
          described above. The ID is never linked to your name, email, phone number
          or Apple ID.
        </p>

        <h2 style={h2}>What stays on your phone</h2>
        <p style={p}>
          Your log — how a quest went, what you wrote afterwards — is stored only on
          your device. We never receive it, cannot read it, and it is not backed up
          to our servers. Deleting the app deletes it.
        </p>

        <h2 style={h2}>What we don&rsquo;t do</h2>
        <p style={p}>
          The app ships with no analytics SDK, no crash-reporting SDK, and no
          advertising or tracking frameworks. We do not sell or share your
          information, we do not build advertising profiles, and there is no social
          feed, so nothing you do in the app is visible to anyone else.
        </p>

        <h2 style={h2}>The website</h2>
        <p style={p}>
          This site sets no cookies and loads no third-party tracking scripts. It
          keeps a small set of daily totals so we can tell whether anyone is
          finding it: how many pages were opened, how many visits that was, how
          many people pressed the download button, roughly what share arrived on a
          phone, and the bare domain name of the site that linked here (for
          example &ldquo;reddit.com&rdquo;, never the full address of the page you
          came from).
        </p>
        <p style={p}>
          Every one of those is a running total for a given day. No identifier, IP
          address, or device fingerprint is recorded, and no row is ever written
          for an individual visitor &mdash; so one visit cannot be told apart from
          another, sessions cannot be reconstructed, and none of it can be traced
          back to you. The only thing stored on your device is a single flag in
          session storage, used so that reloading the page doesn&rsquo;t count you
          twice; it never leaves your browser and disappears when you close the
          tab.
        </p>

        <h2 style={h2}>Services we rely on</h2>
        <p style={p}>
          To turn a hesitation into a real quest, we pass your request and general
          location to a small number of processors, who handle it on our behalf:
        </p>
        <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
          <li style={li}>
            <strong>Google Firebase</strong> — anonymous authentication, database,
            and hosting.
          </li>
          <li style={li}>
            <strong>Google Places</strong> — finding real venues near you.
          </li>
          <li style={li}>
            <strong>Google Gemini, Groq, Mistral, and Cerebras</strong> — generating
            the wording of your quests. Requests carry the hesitation and area, never
            your identity or your log.
          </li>
        </ul>
        <p style={p}>
          If you install through TestFlight, Apple additionally collects beta
          engagement and crash data under{" "}
          <a
            href="https://www.apple.com/legal/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: color.rust }}
          >
            Apple&rsquo;s privacy policy
          </a>
          . That is outside our control.
        </p>

        <h2 style={h2}>Deleting your data</h2>
        <p style={p}>
          Delete the app and your on-device log goes with it. The temporary records
          tied to your anonymous sign-in &mdash; the rate-limit stamp and the
          prepared batch &mdash; expire by themselves. Beyond that there is nothing
          of yours for us to hand back or delete, because nothing we keep is
          attached to you in the first place. If you have a question about any of
          this, email{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: color.rust }}>
            {CONTACT}
          </a>{" "}
          from the device in question and we will remove them.
        </p>

        <h2 style={h2}>Children</h2>
        <p style={p}>
          Horizon sends people to real places and is not directed at children under
          13. We do not knowingly collect information from them.
        </p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>
          If what the app collects changes, this page changes with it, and the date
          at the top moves. Questions are welcome at{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: color.rust }}>
            {CONTACT}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
