import { createBrowserRouter, Navigate } from "react-router-dom";
import Landing from "./routes/Landing";
import Onboarding from "./routes/onboarding/Onboarding";
import AppLayout from "./routes/app/AppLayout";
import Home from "./routes/app/Home";
import Create from "./routes/app/Create";
import Completion from "./routes/app/Completion";
import History from "./routes/app/History";
import CompletedDetail from "./routes/app/CompletedDetail";
import Settings from "./routes/app/Settings";
import Dev from "./routes/app/Dev";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/app/onboarding", element: <Onboarding /> },
  { path: "/app/complete/:questId", element: <Completion /> },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/app/home" replace /> },
      { path: "home", element: <Home /> },
      { path: "create", element: <Create /> },
      { path: "history", element: <History /> },
      { path: "history/:questId", element: <CompletedDetail /> },
      { path: "settings", element: <Settings /> },
      { path: "dev", element: <Dev /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
