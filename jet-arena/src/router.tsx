import { createBrowserRouter,Navigate } from "react-router-dom";

import { routes } from "./hooks/useRoutes";
import { BroadcastPage } from "./pages/BroadcastPage";
import { FighterWizardPage } from "./pages/wizard/FighterWizardPage";

export const router = createBrowserRouter([
  {
    path: routes.broadcast(":id"),
    element: <BroadcastPage />,
  },
  {
    path: routes.fighterWizard(":id"),
    element: <FighterWizardPage />,
  },
  {
    path: "*",
    element: <Navigate to={routes.broadcast("local")} replace />,
  },
]);
