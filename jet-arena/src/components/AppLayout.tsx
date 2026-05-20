import { Outlet } from "react-router-dom";

import { NavbarBreadcrumbContextController } from "../context/NavbarBreadcrumb/NavbarBreadcrumbContextController";
import { Navbar } from "./Navbar";

export const AppLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <NavbarBreadcrumbContextController>
      <Navbar />
      <Outlet />
    </NavbarBreadcrumbContextController>
  </div>
);
