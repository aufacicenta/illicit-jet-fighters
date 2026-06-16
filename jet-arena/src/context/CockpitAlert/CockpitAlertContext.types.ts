import type { ReactNode } from "react";

export type CockpitAlert = {
  id: string;
  message: string;
  createdAt: number;
};

export type CockpitAlertContextControllerProps = {
  children: ReactNode;
};

export type CockpitAlertContextType = {
  currentAlert: CockpitAlert | null;
  pushAlert: (message: unknown) => void;
  dismissAlert: (id: string) => void;
};
