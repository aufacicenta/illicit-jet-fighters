import { Outlet } from "react-router-dom";

import { WalletContextController } from "../context/Wallet/WalletContextController";

export const AppLayout = () => {
  return (
    <div className="app-fuselage-background min-h-screen text-foreground">
      <WalletContextController>
        <main className="relative">
          <Outlet />
        </main>
      </WalletContextController>
    </div>
  );
};
