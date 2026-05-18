import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "./context/Auth/RequireAuth";
import { routes } from "./hooks/useRoutes";
import { BroadcastPage } from "./pages/BroadcastPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { FighterWizardPage } from "./pages/wizard/FighterWizardPage";

export const router = createBrowserRouter([
  {
    path: routes.login(),
    element: <LoginPage />,
  },
  {
    path: routes.signup(),
    element: <SignupPage />,
  },
  {
    path: routes.broadcast(":id"),
    element: <BroadcastPage />,
  },
  {
    path: routes.fighterWizard(":id"),
    element: (
      <RequireAuth>
        <FighterWizardPage />
      </RequireAuth>
    ),
  },
  {
    path: "*",
    element: <Navigate replace to="/broadcast/local" />,
  },
]);
