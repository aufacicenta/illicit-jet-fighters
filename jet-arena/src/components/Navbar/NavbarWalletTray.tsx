import { useAuth } from "../../context/Auth/useAuth";
import { useOptionalWalletContext } from "../../context/Wallet/useOptionalWalletContext";
import { WalletContextController } from "../../context/Wallet/WalletContextController";
import { Skeleton } from "../ui/skeleton";
import { NavbarPublicActions } from "./NavbarPublicActions";
import { NavbarWalletPill } from "./NavbarWalletPill";

const NavbarWalletPillWithProvider = () => (
  <WalletContextController>
    <NavbarWalletPill />
  </WalletContextController>
);

export const NavbarWalletTray = () => {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const walletContext = useOptionalWalletContext();

  if (isBootstrapping) {
    return <Skeleton className="h-8 w-[220px]" />;
  }

  if (!isAuthenticated) {
    return <NavbarPublicActions />;
  }

  if (walletContext === undefined) {
    return <NavbarWalletPillWithProvider />;
  }

  return <NavbarWalletPill />;
};
