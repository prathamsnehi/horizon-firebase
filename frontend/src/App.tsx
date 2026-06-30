import { createBrowserRouter, Navigate } from "react-router-dom";
import Landing from "./routes/Landing";
import Onboarding from "./routes/onboarding/Onboarding";
import AppLayout from "./routes/app/AppLayout";
import Home from "./routes/app/Home";
import Discover from "./routes/app/Discover";
import Completion from "./routes/app/Completion";
import History from "./routes/app/History";
import CompletedDetail from "./routes/app/CompletedDetail";

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
      { path: "discover", element: <Discover /> },
      { path: "history", element: <History /> },
      { path: "history/:questId", element: <CompletedDetail /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
