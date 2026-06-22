"use client";

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { routes } from "../../hooks/useRoutes";
import {
  deleteBattlefield,
  fetchBattlefieldPipelineState,
  fetchMyBattlefields,
} from "../../lib/api";
import type { BattlefieldListItem } from "../../lib/api/types";
import { resolveBattlefieldName } from "../../pages/terminal/components/BattlefieldCard";
import { MyBattlefieldsContext } from "./MyBattlefieldsContext";
import type {
  MyBattlefieldsContextControllerProps,
  MyBattlefieldsContextType,
} from "./MyBattlefieldsContext.types";

const DELETE_SLIDE_DURATION_MS = 300;

export const MyBattlefieldsContextController = ({
  children,
}: MyBattlefieldsContextControllerProps) => {
  const navigate = useNavigate();

  const [battlefields, setBattlefields] = useState<BattlefieldListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBattlefieldId, setDeletingBattlefieldId] = useState<number | null>(null);
  const [confirmDeleteBattlefieldId, setConfirmDeleteBattlefieldId] = useState<number | null>(null);
  const [exitingBattlefieldIds, setExitingBattlefieldIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMyBattlefields();
      const battlefieldsWithSheet = await Promise.all(
        response.battlefields.map(async (battlefield) => {
          try {
            const snapshot = await fetchBattlefieldPipelineState(String(battlefield.id));
            const specsheetImageUrl =
              snapshot?.outputs["battlefield-sheet-image"]?.assetUrl ??
              snapshot?.outputs["battlefield-sheet-image"]?.content ??
              null;
            return { ...battlefield, specsheetImageUrl };
          } catch {
            return { ...battlefield, specsheetImageUrl: null };
          }
        }),
      );
      setBattlefields(battlefieldsWithSheet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load battlefields.");
      setBattlefields([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const promptDelete = useCallback(
    (battlefieldId: number) => {
      if (deletingBattlefieldId !== null) {
        return;
      }
      setDeleteError(null);
      setConfirmDeleteBattlefieldId(battlefieldId);
    },
    [deletingBattlefieldId],
  );

  const confirmDelete = useCallback(async () => {
    const battlefieldId = confirmDeleteBattlefieldId;
    if (battlefieldId === null || deletingBattlefieldId !== null) {
      return;
    }

    const battlefield = battlefields.find((item) => item.id === battlefieldId);
    if (!battlefield) {
      setConfirmDeleteBattlefieldId(null);
      return;
    }

    setDeleteError(null);
    setDeletingBattlefieldId(battlefieldId);
    setConfirmDeleteBattlefieldId(null);
    setExitingBattlefieldIds((current) =>
      current.includes(battlefieldId) ? current : [...current, battlefieldId],
    );

    try {
      await deleteBattlefield(battlefieldId);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, DELETE_SLIDE_DURATION_MS);
      });
      setBattlefields((current) => current.filter((item) => item.id !== battlefieldId));
    } catch (err) {
      setExitingBattlefieldIds((current) => current.filter((id) => id !== battlefieldId));
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete battlefield right now.",
      );
    } finally {
      setDeletingBattlefieldId((current) => (current === battlefieldId ? null : current));
      setExitingBattlefieldIds((current) => current.filter((id) => id !== battlefieldId));
    }
  }, [battlefields, confirmDeleteBattlefieldId, deletingBattlefieldId]);

  const cancelDelete = useCallback(() => {
    if (deletingBattlefieldId !== null) {
      return;
    }
    setConfirmDeleteBattlefieldId(null);
  }, [deletingBattlefieldId]);

  const openWizard = useCallback(
    (battlefieldId: number) => {
      navigate(routes.battlefieldWizard(String(battlefieldId)));
    },
    [navigate],
  );

  const battlefieldPendingDelete =
    confirmDeleteBattlefieldId === null
      ? null
      : (battlefields.find((item) => item.id === confirmDeleteBattlefieldId) ?? null);
  const pendingDeleteName = battlefieldPendingDelete
    ? resolveBattlefieldName(battlefieldPendingDelete)
    : null;

  const value: MyBattlefieldsContextType = {
    battlefields,
    isLoading,
    error,
    deleteError,
    deletingBattlefieldId,
    exitingBattlefieldIds,
    isDeleteDialogOpen: confirmDeleteBattlefieldId !== null,
    pendingDeleteName,
    load,
    promptDelete,
    confirmDelete,
    cancelDelete,
    openWizard,
  };

  return <MyBattlefieldsContext.Provider value={value}>{children}</MyBattlefieldsContext.Provider>;
};
