import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./context/Auth/RequireAuth";
import { routes } from "./hooks/useRoutes";
import { BroadcastPage } from "./pages/BroadcastPage";
import { CreateBattlefieldPage } from "./pages/CreateBattlefieldPage";
import { CreateFighterPage } from "./pages/CreateFighterPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { FighterBalancePage } from "./pages/terminal/FighterBalancePage";
import { MyFightersPage } from "./pages/terminal/MyFightersPage";
import { TerminalSimulationPage } from "./pages/terminal/TerminalSimulationPage";
import { WalletPage } from "./pages/terminal/WalletPage";
import { BattlefieldWizardPage } from "./pages/wizard/BattlefieldWizardPage";
import { FighterWizardPage } from "./pages/wizard/FighterWizardPage";

export const router = createBrowserRouter([
  {
    path: routes.home(),
    element: <HomePage />,
  },
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
        path: routes.terminalFighterBalance(":id"),
        element: <FighterBalancePage />,
      },
      {
        path: routes.createFighter(),
        element: <CreateFighterPage />,
      },
      {
        path: routes.createBattlefield(),
        element: <CreateBattlefieldPage />,
      },
      {
        path: routes.terminalSimulation(),
        element: <TerminalSimulationPage />,
      },
      {
        path: routes.terminalWallet(),
        element: <WalletPage />,
      },
      {
        path: routes.terminalSimulation(),
        element: <Navigate replace to={routes.terminalSimulation()} />,
      },
      {
        path: routes.fighterWizard(":id"),
        element: <FighterWizardPage />,
      },
      {
        path: routes.battlefieldWizard(":id"),
        element: <BattlefieldWizardPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to={routes.home()} />,
  },
]);
