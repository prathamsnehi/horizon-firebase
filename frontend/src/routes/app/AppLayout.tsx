import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  Compass,
  Home,
  History as HistoryIcon,
  Settings as SettingsIcon,
  FlaskConical,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Logo } from "../../components/Logo";
import { ThemeToggle } from "../../components/ThemeToggle";
import {
  selectAvailable,
  selectSkipped,
  useAppStore,
} from "../../store/useAppStore";

const NAV = [
  { to: "/app/home", label: "Home", icon: Home },
  { to: "/app/discover", label: "Discover", icon: Compass },
  { to: "/app/history", label: "History", icon: HistoryIcon },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
  { to: "/app/dev", label: "Dev", icon: FlaskConical },
];

export default function AppLayout() {
  const location = useLocation();
  const hasOnboarded = useAppStore((s) => s.hasCompletedOnboarding);
  const deckCount = useAppStore(
    (s) => selectAvailable(s).length + selectSkipped(s).length
  );

  if (!hasOnboarded) {
    return <Navigate to="/app/onboarding" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-full bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-5 md:flex">
        <NavLink to="/" className="mb-8 px-2">
          <Logo />
        </NavLink>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center justify-between rounded-xl px-3 py-2.5 text-headline font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )
              }
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </span>
              {item.label === "Discover" && deckCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-caption font-bold text-primary-foreground">
                  {deckCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between px-1">
          <span className="text-footnote text-muted-foreground">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-caption font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
            {item.label === "Discover" && deckCount > 0 && (
              <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {deckCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
