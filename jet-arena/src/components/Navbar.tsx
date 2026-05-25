import { useMemo } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";

import { useNavbarBreadcrumbContext } from "../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { routes } from "../hooks/useRoutes";
import { CockpitStatScreens } from "./Navbar/CockpitStatScreens";
import { NavbarWalletTray } from "./Navbar/NavbarWalletTray";

const getBaseBreadcrumb = (pathname: string) => {
  if (matchPath(routes.broadcast(":id"), pathname)) {
    return "Broadcast / Live Match";
  }
  if (matchPath(routes.fighterWizard(":id"), pathname)) {
    return "Pilot Intake Terminal";
  }
  if (pathname === routes.terminalFighters()) {
    return "Terminal / My Fighters";
  }
  if (pathname === routes.createFighter()) {
    return "Terminal / New Fighter";
  }
  if (pathname === routes.terminalWallet()) {
    return "Terminal / Wallet";
  }
  return "Terminal";
};

export const Navbar = () => {
  const location = useLocation();
  const { currentSectionLabel } = useNavbarBreadcrumbContext();

  const breadcrumbLabel = useMemo(() => {
    const baseLabel = getBaseBreadcrumb(location.pathname);

    if (!matchPath(routes.fighterWizard(":id"), location.pathname) || !currentSectionLabel) {
      return baseLabel;
    }

    return `${baseLabel} / ${currentSectionLabel}`;
  }, [currentSectionLabel, location.pathname]);

  return (
    <nav
      className="fixed z-20 w-screen border-b border-border"
      style={{
        backgroundImage: "url('/fuselage-army-green.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <CockpitStatScreens />

      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="grid max-h-[100px] w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3">
          <div aria-hidden />
          <Link
            className="relative z-10 block justify-self-center pt-4"
            to={routes.terminalFighters()}
          >
            <img alt="Illicit Jet Fighters" className="w-full max-w-[280px]" src="/ijf-logo.svg" />
          </Link>
          <div className="justify-self-end"></div>
        </div>
      </div>
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-border/70 px-4 py-1">
        <div>
          <p className="w-full text-xs tracking-widest text-muted-foreground uppercase">
            {breadcrumbLabel}
          </p>
        </div>
        <div aria-hidden />
        <div className="justify-self-end">
          <NavbarWalletTray />
        </div>
      </div>
    </nav>
  );
};
