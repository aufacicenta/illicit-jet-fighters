import type { NavigateFunction } from "react-router-dom";

import { routes } from "../hooks/useRoutes";
import { battlefieldCreatePost } from "./api";

/** Creates a fresh battlefield row for the current user and opens the intake wizard for it. */
export const navigateToNewBattlefieldWizard = async (
  navigate: NavigateFunction,
  options: { replace?: boolean } = {},
) => {
  const { id } = await battlefieldCreatePost();
  navigate(routes.battlefieldWizard(String(id)), { replace: options.replace ?? true });
};
