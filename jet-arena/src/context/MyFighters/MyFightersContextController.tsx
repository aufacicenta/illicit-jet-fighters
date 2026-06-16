"use client";

import { type MyFighter, resolveFighterName } from "@ijf/shared";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { routes } from "../../hooks/useRoutes";
import { deleteFighter, fetchMyFighters } from "../../lib/api";
import { MyFightersContext } from "./MyFightersContext";
import type {
  MyFightersContextControllerProps,
  MyFightersContextType,
} from "./MyFightersContext.types";

const DELETE_SLIDE_DURATION_MS = 300;

export const MyFightersContextController = ({ children }: MyFightersContextControllerProps) => {
  const navigate = useNavigate();

  const [fighters, setFighters] = useState<MyFighter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingFighterId, setDeletingFighterId] = useState<number | null>(null);
  const [confirmDeleteFighterId, setConfirmDeleteFighterId] = useState<number | null>(null);
  const [exitingFighterIds, setExitingFighterIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMyFighters();
      setFighters(response.fighters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fighter roster.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const promptDelete = useCallback(
    (fighterId: number) => {
      if (deletingFighterId !== null) {
        return;
      }
      setDeleteError(null);
      setConfirmDeleteFighterId(fighterId);
    },
    [deletingFighterId],
  );

  const confirmDelete = useCallback(async () => {
    const fighterId = confirmDeleteFighterId;
    if (fighterId === null || deletingFighterId !== null) {
      return;
    }

    const fighter = fighters.find((item) => item.id === fighterId);
    if (!fighter) {
      setConfirmDeleteFighterId(null);
      return;
    }

    setDeleteError(null);
    setDeletingFighterId(fighterId);
    setConfirmDeleteFighterId(null);
    setExitingFighterIds((current) =>
      current.includes(fighterId) ? current : [...current, fighterId],
    );

    try {
      await deleteFighter(fighterId);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, DELETE_SLIDE_DURATION_MS);
      });
      setFighters((current) => current.filter((item) => item.id !== fighterId));
    } catch (err) {
      setExitingFighterIds((current) => current.filter((id) => id !== fighterId));
      setDeleteError(err instanceof Error ? err.message : "Unable to delete fighter right now.");
    } finally {
      setDeletingFighterId((current) => (current === fighterId ? null : current));
      setExitingFighterIds((current) => current.filter((id) => id !== fighterId));
    }
  }, [confirmDeleteFighterId, deletingFighterId, fighters]);

  const cancelDelete = useCallback(() => {
    if (deletingFighterId !== null) {
      return;
    }
    setConfirmDeleteFighterId(null);
  }, [deletingFighterId]);

  const openWizard = useCallback(
    (fighterId: number) => {
      navigate(routes.fighterWizard(String(fighterId)));
    },
    [navigate],
  );

  const fighterPendingDelete =
    confirmDeleteFighterId === null
      ? null
      : (fighters.find((item) => item.id === confirmDeleteFighterId) ?? null);
  const pendingDeleteName = fighterPendingDelete
    ? resolveFighterName({
        storedName: fighterPendingDelete.name,
        characterDescription: fighterPendingDelete.characterDescription,
        slug: fighterPendingDelete.slug,
      })
    : null;

  const value: MyFightersContextType = {
    fighters,
    isLoading,
    error,
    deleteError,
    deletingFighterId,
    exitingFighterIds,
    isDeleteDialogOpen: confirmDeleteFighterId !== null,
    pendingDeleteName,
    load,
    promptDelete,
    confirmDelete,
    cancelDelete,
    openWizard,
  };

  return <MyFightersContext.Provider value={value}>{children}</MyFightersContext.Provider>;
};
