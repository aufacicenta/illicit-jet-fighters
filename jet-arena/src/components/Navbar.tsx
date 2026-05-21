import { useMemo } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";

import { useNavbarBreadcrumbContext } from "../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { routes } from "../hooks/useRoutes";

const getBaseBreadcrumb = (pathname: string) => {
  if (matchPath(routes.fighterWizard(":id"), pathname)) {
    return "Pilot Intake Terminal";
  }
  if (pathname === routes.terminalFighters()) {
    return "Terminal / My Fighters";
  }
  if (pathname === routes.createFighter()) {
    return "Terminal / New Fighter";
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
    <nav className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3">
          <div aria-hidden />
          <Link className="justify-self-center" to={routes.terminalFighters()}>
            <img alt="Illicit Jet Fighters" className="w-full max-w-[280px]" src="/ijf-logo.svg" />
          </Link>
          <div aria-hidden className="justify-self-end" />
        </div>
      </div>
      <div className="w-full border-t border-border/70 px-4 py-1">
        <p className="w-full text-xs tracking-widest text-muted-foreground uppercase">
          {breadcrumbLabel}
        </p>
      </div>
    </nav>
  );
};
