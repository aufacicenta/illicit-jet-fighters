import { createContext } from "react";

import type { NavbarBreadcrumbContextType } from "./NavbarBreadcrumbContext.types";

export const NavbarBreadcrumbContext = createContext<NavbarBreadcrumbContextType | undefined>(
  undefined,
);
