import { useMemo } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";

import { useNavbarBreadcrumbContext } from "../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { routes } from "../hooks/useRoutes";

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

    if (!currentSectionLabel) {
      return baseLabel;
    }

    return `${baseLabel} / ${currentSectionLabel}`;
  }, [currentSectionLabel, location.pathname]);

  return (
    <nav
      className="fixed z-20 h-(--navbar-height) w-screen border-b border-border flex flex-col justify-end"
      style={{
        backgroundImage: "url('/fuselage-army-green.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="absolute bottom-[-23px] h-[23px] w-full bg-[url('/navbar-bottom-frame.png')] bg-cover bg-center bg-no-repeat" />

      <div>
        <div className="mx-auto flex w-full flex-col">
          <div className="flex max-h-[100px] w-full justify-between items-center gap-3 pb-3">
            <div aria-hidden />
            <Link
              className="relative z-30 block justify-self-center top-[17px]"
              to={routes.createFighter()}
            >
              <img
                alt="Illicit Jet Fighters"
                className="w-full max-w-[280px]"
                src="/ijf-logo.svg"
              />
            </Link>
            <div className="justify-self-end"></div>
          </div>
        </div>

        <div className="w-full items-center gap-3 border-t border-border/70 px-4 py-1 flex justify-between">
          <div>
            <p className="w-full text-xs tracking-widest text-muted-foreground uppercase">
              {breadcrumbLabel}
            </p>
          </div>
          <div aria-hidden />
          <div aria-hidden />
        </div>
      </div>
    </nav>
  );
};
