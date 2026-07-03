import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App";
import { initTheme } from "./lib/theme";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "leaflet/dist/leaflet.css";
import "./index.css";

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
