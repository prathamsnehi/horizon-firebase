import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "./routes/Home";

/**
 * The admin app — and with it Firebase, the dashboard and the log viewer — is
 * loaded only when someone navigates to /admin. A visitor to `/` downloads the
 * React runtime and the marketing site, and nothing else (the marketing route
 * and everything it imports is deliberately Firebase-free).
 */
const Admin = lazy(() => import("./routes/admin/Admin"));

function AdminChunk() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center text-tiny text-dim">
          Loading…
        </div>
      }
    >
      <Admin />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/admin/*", element: <AdminChunk /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
