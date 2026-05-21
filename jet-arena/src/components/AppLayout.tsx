import { Outlet } from "react-router-dom";

import { Navbar } from "./Navbar";

export const AppLayout = () => (
  <div className="app-fuselage-background min-h-screen text-foreground">
    <Navbar />
    <Outlet />
  </div>
);
