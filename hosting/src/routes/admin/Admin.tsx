import { useState } from "react";
import { Route, Routes, NavLink } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { isFirebaseConfigured } from "../../lib/firebase";
import Dashboard from "./Dashboard";
import Logs from "./Logs";
import LogDetail from "./LogDetail";

/**
 * The admin entry point, and the only module that pulls in Firebase — which is
 * what keeps it out of the bundle a visitor to `/` downloads.
 *
 * The gate here decides what to RENDER. It is not the security boundary: the
 * Firestore rules are, and they refuse `generation_samples` to any account
 * without an `admins/{uid}` document. Someone who bypasses this component gets
 * an empty screen and a permission error, not data.
 */
export default function Admin() {
  const auth = useAuth();

  if (!isFirebaseConfigured()) {
    return (
      <Centered title="Not configured">
        <p className="text-tiny leading-relaxed text-dim">
          Replace the <code className="text-fg">REPLACE_ME</code> values in{" "}
          <code className="text-fg">hosting/src/lib/firebase.ts</code> with the
          web app config from the Firebase console (Project settings → Your apps
          → Web).
        </p>
      </Centered>
    );
  }

  if (auth.status === "loading") {
    return <Centered title="Checking access…" />;
  }

  if (auth.status === "signed-out") {
    return (
      <Centered title="Horizon admin">
        <p className="mb-5 text-tiny text-dim">
          Sign in with an allowlisted Google account.
        </p>
        <button
          onClick={() => void auth.signIn()}
          className="ring-focus rounded-lg bg-accent px-4 py-2 text-tiny font-semibold text-page transition-opacity hover:opacity-90"
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }

  if (auth.status === "not-authorized") {
    return (
      <Centered title="Not authorized">
        <p className="mb-4 text-tiny text-dim">
          {auth.user.email} isn&rsquo;t on the admin list.
        </p>
        {/* The uid is only knowable after signing in, and it is exactly what
            has to be pasted into Firestore to grant access — so show it here
            rather than sending someone hunting through the console. */}
        <UidBlock uid={auth.user.uid} />
        <button
          onClick={() => void auth.signOutNow()}
          className="ring-focus mt-4 rounded-lg border border-line px-4 py-2 text-tiny font-medium text-dim hover:text-fg"
        >
          Sign out
        </button>
      </Centered>
    );
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <span className="text-tiny font-semibold tracking-wide">Horizon</span>
          <nav className="flex gap-1">
            {[
              { to: "/admin", label: "Dashboard", end: true },
              { to: "/admin/logs", label: "Logs", end: false },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `ring-focus rounded-lg px-3 py-1.5 text-tiny font-medium transition-colors ${
                    isActive
                      ? "bg-raised text-fg"
                      : "text-muted hover:text-dim"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-micro text-muted sm:inline">
              {auth.user.email}
            </span>
            <button
              onClick={() => void auth.signOutNow()}
              className="ring-focus rounded-lg border border-line px-2.5 py-1 text-micro text-muted hover:text-fg"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
          <Route path="logs/:id" element={<LogDetail />} />
        </Routes>
      </main>
    </div>
  );
}

function UidBlock({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-page p-3 text-left">
      <div className="mb-1.5 text-micro uppercase tracking-wide text-muted">
        Your user ID
      </div>
      <code className="block break-all font-mono text-tiny text-fg">{uid}</code>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(uid).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="ring-focus mt-2 rounded-md border border-line px-2 py-1 text-micro text-dim hover:text-fg"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <p className="mt-3 text-micro leading-relaxed text-muted">
        Grant access by creating a Firestore document at{" "}
        <code className="text-dim">admins/{uid}</code> — the contents don&rsquo;t
        matter, only that it exists.
      </p>
    </div>
  );
}

function Centered({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="mb-2 text-base font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
