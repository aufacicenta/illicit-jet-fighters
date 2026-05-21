import { Outlet } from "react-router-dom";

import { NavbarBreadcrumbContextController } from "../context/NavbarBreadcrumb/NavbarBreadcrumbContextController";
import { Navbar } from "./Navbar";

export const AppLayout = () => (
  <div className="app-fuselage-background min-h-screen text-foreground">
    <NavbarBreadcrumbContextController>
      <Navbar />
      <Outlet />
    </NavbarBreadcrumbContextController>
  </div>
);
