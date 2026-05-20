import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./context/Auth/RequireAuth";
import { routes } from "./hooks/useRoutes";
import { BroadcastPage } from "./pages/BroadcastPage";
import { CreateFighterPage } from "./pages/CreateFighterPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { MyFightersPage } from "./pages/terminal/MyFightersPage";
import { TerminalSimulationPage } from "./pages/terminal/TerminalSimulationPage";
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
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: routes.terminalFighters(),
        element: <MyFightersPage />,
      },
      {
        path: routes.createFighter(),
        element: <CreateFighterPage />,
      },
      {
        path: routes.terminalSimulation(),
        element: <TerminalSimulationPage />,
      },
      {
        path: "/wizard/fighter/:id",
        element: <FighterWizardPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/broadcast/local" />,
  },
]);
