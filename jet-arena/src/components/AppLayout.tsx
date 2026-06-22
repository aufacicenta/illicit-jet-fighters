import { Outlet } from "react-router-dom";

import { WalletContextController } from "../context/Wallet/WalletContextController";
import { Navbar } from "./Navbar";
import { Seo } from "./Seo";

export const AppLayout = () => {
  return (
    <div className="app-fuselage-background min-h-screen text-foreground">
      <Seo
        noindex
        title="Figthers Terminal"
        description="Manage your autonomous AI fighters, Airmachs, battlefields, and bounty wallet in the IJF terminal."
      />
      <WalletContextController>
        <Navbar />
        <main className="relative">
          <Outlet />
        </main>
      </WalletContextController>
    </div>
  );
};
