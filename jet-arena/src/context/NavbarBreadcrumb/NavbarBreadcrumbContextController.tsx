"use client";

import { useCallback, useMemo, useState } from "react";

import { NavbarBreadcrumbContext } from "./NavbarBreadcrumbContext";
import type {
  NavbarBreadcrumbContextControllerProps,
  NavbarBreadcrumbContextType,
} from "./NavbarBreadcrumbContext.types";

export const NavbarBreadcrumbContextController = ({
  children,
}: NavbarBreadcrumbContextControllerProps) => {
  const [currentSectionLabel, setCurrentSectionLabelState] = useState<string | null>(null);

  const setCurrentSectionLabel = useCallback((label: string | null) => {
    const nextLabel = label?.trim();
    setCurrentSectionLabelState(nextLabel && nextLabel.length > 0 ? nextLabel : null);
  }, []);

  const clearCurrentSectionLabel = useCallback(() => {
    setCurrentSectionLabelState(null);
  }, []);

  const props = useMemo<NavbarBreadcrumbContextType>(
    () => ({
      currentSectionLabel,
      setCurrentSectionLabel,
      clearCurrentSectionLabel,
    }),
    [clearCurrentSectionLabel, currentSectionLabel, setCurrentSectionLabel],
  );

  return (
    <NavbarBreadcrumbContext.Provider value={props}>{children}</NavbarBreadcrumbContext.Provider>
  );
};
