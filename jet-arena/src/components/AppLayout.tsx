import { Outlet } from "react-router-dom";

import { WalletContextController } from "../context/Wallet/WalletContextController";
import { CockpitStatScreens } from "./Navbar/CockpitStatScreens";

export const AppLayout = () => (
  <div className="app-fuselage-background min-h-screen text-foreground">
    <WalletContextController>
      <CockpitStatScreens />
      <main className="page-with-navbar-offset page-with-screen-bottom-offset">
        <Outlet />
      </main>
    </WalletContextController>
  </div>
);
