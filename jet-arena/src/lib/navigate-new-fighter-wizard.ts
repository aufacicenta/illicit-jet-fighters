import type { NavigateFunction } from "react-router-dom";

import { routes } from "../hooks/useRoutes";
import { fighterSessionPost } from "./api";

/** Ensures a fighter row exists for the current user and opens the intake wizard for it. */
export const navigateToNewFighterWizard = async (
  navigate: NavigateFunction,
  options: { replace?: boolean } = {},
) => {
  const { id } = await fighterSessionPost();
  navigate(routes.fighterWizard(String(id)), { replace: options.replace ?? true });
};
