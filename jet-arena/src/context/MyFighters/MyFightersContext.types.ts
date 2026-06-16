import type { MyFighter } from "@ijf/shared";
import type { ReactNode } from "react";

export type MyFightersContextControllerProps = {
  children: ReactNode;
};

export type MyFightersContextType = {
  fighters: MyFighter[];
  isLoading: boolean;
  error: string | null;
  deleteError: string | null;
  deletingFighterId: number | null;
  exitingFighterIds: number[];
  isDeleteDialogOpen: boolean;
  pendingDeleteName: string | null;

  load: () => Promise<void>;
  promptDelete: (fighterId: number) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  openWizard: (fighterId: number) => void;
};
