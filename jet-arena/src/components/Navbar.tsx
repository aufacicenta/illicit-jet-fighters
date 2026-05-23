import { useMemo } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";

import { useNavbarBreadcrumbContext } from "../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { routes } from "../hooks/useRoutes";
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
    <nav className="relative border-b border-border mb-[120px] w-screen">
      <div className="w-screen relative" id="navbar-top-screens-frame">
        <div
          className="z-10 top-0 w-full pointer-events-none absolute inset-x-0 bottom-0"
          id="navbar-top-center-screen"
        >
          <div
            aria-hidden
            className="h-[259px] bg-[url('/navbar-bottom-frame.png')] bg-center bg-no-repeat"
          />
          <div className="absolute overlay-text text-center w-screen top-[173px] flex justify-center">
            <div className="w-[470px] h-[68px] flex flex-col justify-center">
              <p className="text-xs">this is an overlay text</p>
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="z-9 top-[158px] left-0 w-screen pointer-events-none absolute inset-x-0"
          id="navbar-left-center-screen"
        >
          <div
            aria-hidden
            className="left-0 top-0 pointer-events-none absolute w-[397px] h-[81px] bg-[url('/navbar-bottom-left-screen.png')] bg-center bg-no-repeat"
          />
          <div className="absolute overlay-text text-center w-[345px] top-[10px] left-[17px] h-[68px]">
            <p className="text-xs">this is an overlay text</p>
          </div>
        </div>
        <div
          aria-hidden
          className="z-9 top-[158px] right-0 pointer-events-none absolute inset-x-0 w-full"
          id="navbar-top-right-screen"
        >
          <div
            aria-hidden
            className="top-0 right-0 pointer-events-none absolute w-[397px] h-[81px] bg-[url('/navbar-bottom-right-screen.png')] bg-center bg-no-repeat"
          />
          <div className="absolute overlay-text text-center w-[345px] top-[10px] right-[17px] h-[68px]">
            <p className="text-xs">this is an overlay text</p>
          </div>
        </div>
      </div>

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
