import "./styles.css";

import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AuthContextController } from "./context/Auth/AuthContextController";
import { CockpitStatsContextController } from "./context/CockpitStats/CockpitStatsContextController";
import { NavbarBreadcrumbContextController } from "./context/NavbarBreadcrumb/NavbarBreadcrumbContextController";
import { router } from "./router";

const UnregisterLegacyServiceWorkers = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (window.location.pathname.startsWith("/broadcast/")) {
      return;
    }

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch (error) {
        console.warn("Service worker cleanup failed:", error);
      }
    })();
  }, []);

  return null;
};

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Missing root mount element.");
}

createRoot(rootElement).render(
  <AuthContextController>
    <CockpitStatsContextController>
      <NavbarBreadcrumbContextController>
        <UnregisterLegacyServiceWorkers />
        <RouterProvider router={router} />
      </NavbarBreadcrumbContextController>
    </CockpitStatsContextController>
  </AuthContextController>,
);
