import { useAuth } from "../../context/Auth/useAuth";
import { useOptionalWalletContext } from "../../context/Wallet/useOptionalWalletContext";
import { WalletContextController } from "../../context/Wallet/WalletContextController";
import { Skeleton } from "../ui/skeleton";
import { NavbarPublicActions } from "./NavbarPublicActions";
import { NavbarWalletPill } from "./NavbarWalletPill";

type NavbarWalletTrayProps = {
  variant?: "navbar" | "cockpit";
};

const NavbarWalletPillWithProvider = ({ variant }: NavbarWalletTrayProps) => (
  <WalletContextController>
    <NavbarWalletPill variant={variant} />
  </WalletContextController>
);

export const NavbarWalletTray = ({ variant = "navbar" }: NavbarWalletTrayProps) => {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const walletContext = useOptionalWalletContext();

  if (isBootstrapping) {
    return <Skeleton className={variant === "cockpit" ? "h-[62px] w-[290px]" : "h-8 w-[220px]"} />;
  }

  if (!isAuthenticated) {
    return <NavbarPublicActions />;
  }

  if (walletContext === undefined) {
    return <NavbarWalletPillWithProvider variant={variant} />;
  }

  return <NavbarWalletPill variant={variant} />;
};
