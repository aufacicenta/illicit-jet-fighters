import { Outlet } from "react-router-dom";

import { Navbar } from "./Navbar";

export const AppLayout = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Navbar />
    <Outlet />
  </div>
);
