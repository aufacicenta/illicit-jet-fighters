import { Outlet } from "react-router-dom";

import { WalletContextController } from "../context/Wallet/WalletContextController";
import { Navbar } from "./Navbar";

export const AppLayout = () => {
  return (
    <div className="app-fuselage-background min-h-screen text-foreground">
      <WalletContextController>
        <Navbar />
        <main className="relative">
          <Outlet />
        </main>
      </WalletContextController>
    </div>
  );
};
