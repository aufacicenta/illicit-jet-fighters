import type { ReactNode } from "react";

import type { BattlefieldListItem } from "../../lib/api/types";

export type MyBattlefieldsContextControllerProps = {
  children: ReactNode;
};

export type MyBattlefieldsContextType = {
  battlefields: BattlefieldListItem[];
  isLoading: boolean;
  error: string | null;
  deleteError: string | null;
  deletingBattlefieldId: number | null;
  exitingBattlefieldIds: number[];
  isDeleteDialogOpen: boolean;
  pendingDeleteName: string | null;

  load: () => Promise<void>;
  promptDelete: (battlefieldId: number) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  openWizard: (battlefieldId: number) => void;
};
