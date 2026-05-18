import type { NavigateFunction } from "react-router-dom";

import { routes } from "../hooks/useRoutes";
import { fighterCreatePost } from "./api";

/** Creates a fresh fighter row for the current user and opens the intake wizard for it. */
export const navigateToNewFighterWizard = async (
  navigate: NavigateFunction,
  options: { replace?: boolean } = {},
) => {
  const { id } = await fighterCreatePost();
  navigate(routes.fighterWizard(String(id)), { replace: options.replace ?? true });
};
