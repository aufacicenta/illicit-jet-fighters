import type { ReactNode } from "react";

export type NavbarBreadcrumbContextControllerProps = {
  children: ReactNode;
};

export type NavbarBreadcrumbContextType = {
  currentSectionLabel: string | null;
  setCurrentSectionLabel: (label: string | null) => void;
  clearCurrentSectionLabel: () => void;
};
