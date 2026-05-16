import { Navigate, createBrowserRouter } from "react-router-dom";

import { BroadcastPage } from "./pages/BroadcastPage";

export const router = createBrowserRouter([
  {
    path: "/broadcast/:id",
    element: <BroadcastPage />,
  },
  {
    path: "*",
    element: <Navigate to="/broadcast/local" replace />,
  },
]);
