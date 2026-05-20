import { useContext } from "react";

import { NavbarBreadcrumbContext } from "./NavbarBreadcrumbContext";

export const useNavbarBreadcrumbContext = () => {
  const context = useContext(NavbarBreadcrumbContext);

  if (context === undefined) {
    throw new Error(
      "useNavbarBreadcrumbContext must be used within a NavbarBreadcrumbContextController",
    );
  }

  return context;
};
