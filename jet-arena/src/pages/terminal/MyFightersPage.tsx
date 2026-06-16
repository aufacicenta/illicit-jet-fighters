import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  CockpitBottomLeftSlot,
  CockpitBottomRightSlot,
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopLeftSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
  TypingEffect,
} from "../../components/Navbar/CockpitStatScreens";
import { NavbarWalletTray } from "../../components/Navbar/NavbarWalletTray";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ArenaPoolsContextController } from "../../context/ArenaPools/ArenaPoolsContextController";
import { useArenaPoolsContext } from "../../context/ArenaPools/useArenaPoolsContext";
import { MyBattlefieldsContextController } from "../../context/MyBattlefields/MyBattlefieldsContextController";
import { useMyBattlefieldsContext } from "../../context/MyBattlefields/useMyBattlefieldsContext";
import { MyFightersContextController } from "../../context/MyFighters/MyFightersContextController";
import { useMyFightersContext } from "../../context/MyFighters/useMyFightersContext";
import {
  isTerminalTab,
  routes,
  TERMINAL_TAB_QUERY_KEY,
  type TerminalTab,
} from "../../hooks/useRoutes";
import { cn } from "../../lib/utils";
import { ArenaPoolsTab } from "./components/ArenaPoolsTab";
import { ArenaQueueTab } from "./components/ArenaQueueTab";
import { MyBattlefieldsTab } from "./components/MyBattlefieldsTab";
import { MyFightersTab } from "./components/MyFightersTab";

const tabTitles: Record<TerminalTab, string> = {
  "my-fighters": "Fighters",
  "my-battlefields": "Battlefields",
  arena: "Arena",
  queue: "Queue",
};

const terminalAsideTabRefreshClassName = cn(
  "ml-auto shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
  "aria-disabled:pointer-events-none aria-disabled:opacity-50",
);

const terminalAsideTabTriggerClassName = cn(
  "group flex w-full items-center justify-start gap-2 rounded-sm border px-2.5 py-2 text-left text-xs font-normal tracking-wide uppercase transition-colors",
  "border-border/70 bg-background hover:border-border hover:bg-muted/60",
  "data-[state=active]:border-secondary data-[state=active]:bg-secondary/10 data-[state=active]:text-foreground data-[state=active]:shadow-none",
);

const MyFightersPageInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get(TERMINAL_TAB_QUERY_KEY);
  const activeTab: TerminalTab = isTerminalTab(tabFromUrl) ? tabFromUrl : "my-fighters";
  const [hasFetchedTab, setHasFetchedTab] = useState<Record<TerminalTab, boolean>>({
    "my-fighters": false,
    "my-battlefields": false,
    arena: false,
    queue: false,
  });

  const {
    isLoading: isLoadingFighters,
    deletingFighterId,
    load: loadFighters,
  } = useMyFightersContext();

  const {
    isLoading: isLoadingBattlefields,
    deletingBattlefieldId,
    load: loadBattlefields,
  } = useMyBattlefieldsContext();

  const { isLoadingPools, isLoadingQueue, leavingEntryId, loadPools, loadQueue } =
    useArenaPoolsContext();

  const handleTabChange = (value: string) => {
    const tab = value as TerminalTab;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (tab === "my-fighters") {
          next.delete(TERMINAL_TAB_QUERY_KEY);
        } else {
          next.set(TERMINAL_TAB_QUERY_KEY, tab);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (hasFetchedTab[activeTab]) {
      return;
    }
    setHasFetchedTab((current) => ({ ...current, [activeTab]: true }));
    if (activeTab === "my-fighters") {
      void loadFighters();
      return;
    }
    if (activeTab === "my-battlefields") {
      void loadBattlefields();
      return;
    }
    if (activeTab === "arena") {
      void Promise.all([loadPools(), loadFighters()]);
      return;
    }
    if (activeTab === "queue") {
      void Promise.all([loadQueue(), loadFighters()]);
      return;
    }
  }, [activeTab, hasFetchedTab, loadBattlefields, loadFighters, loadPools, loadQueue]);

  return (
    <>
      <CockpitStatScreens>
        <CockpitTopLeftSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">Greetings, Commander.</p>
          </TypingEffect>
        </CockpitTopLeftSlot>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">{tabTitles[activeTab]}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <NavbarWalletTray variant="cockpit" />
        </CockpitTopRightSlot>

        <CockpitBottomLeftSlot>
          <TypingEffect>
            <p className="text-xs text-emerald-400">Systems Operational</p>
          </TypingEffect>
        </CockpitBottomLeftSlot>
        <CockpitBottomRightSlot>
          <TypingEffect>
            <span className="text-right text-xs text-highlight">
              Illicit Jet Fighters, 2026.
              <br />
              Agentic E-Sports.
            </span>
          </TypingEffect>
        </CockpitBottomRightSlot>
      </CockpitStatScreens>

      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:px-6">
        <Tabs onValueChange={handleTabChange} value={activeTab}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-8">
            <aside className="w-full lg:sticky lg:top-6 lg:order-2">
              <div className="pt-2">
                {activeTab === "my-fighters" ? (
                  <div className="mb-4 flex flex-col gap-2">
                    <Button asChild className="tracking-[0.12em]" type="button">
                      <Link to={routes.createFighter()}>Create Fighter</Link>
                    </Button>
                  </div>
                ) : null}

                {activeTab === "my-battlefields" ? (
                  <div className="mb-4 flex flex-col gap-2">
                    <Button asChild type="button">
                      <Link to={routes.createBattlefield()}>Create Battlefield</Link>
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="border-border/80 bg-card/70">
                <TabsList className="flex h-auto w-full flex-col gap-0 bg-transparent p-0">
                  <TabsTrigger className={terminalAsideTabTriggerClassName} value="my-fighters">
                    <span className="size-1.5 shrink-0 rounded-full bg-muted group-data-[state=active]:bg-secondary" />
                    <span className="min-w-0 flex-1 truncate">Fighters</span>
                    <span
                      aria-disabled={isLoadingFighters || deletingFighterId !== null}
                      aria-label="Refresh fighters"
                      className={terminalAsideTabRefreshClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isLoadingFighters || deletingFighterId !== null) {
                          return;
                        }
                        void loadFighters();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (isLoadingFighters || deletingFighterId !== null) {
                          return;
                        }
                        void loadFighters();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <RefreshCw className={cn("size-3.5", isLoadingFighters && "animate-spin")} />
                    </span>
                  </TabsTrigger>

                  <TabsTrigger className={terminalAsideTabTriggerClassName} value="my-battlefields">
                    <span className="size-1.5 shrink-0 rounded-full bg-muted group-data-[state=active]:bg-secondary" />
                    <span className="min-w-0 flex-1 truncate">Battlefields</span>
                    <span
                      aria-disabled={isLoadingBattlefields || deletingBattlefieldId !== null}
                      aria-label="Refresh battlefields"
                      className={terminalAsideTabRefreshClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isLoadingBattlefields || deletingBattlefieldId !== null) {
                          return;
                        }
                        void loadBattlefields();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (isLoadingBattlefields || deletingBattlefieldId !== null) {
                          return;
                        }
                        void loadBattlefields();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <RefreshCw
                        className={cn("size-3.5", isLoadingBattlefields && "animate-spin")}
                      />
                    </span>
                  </TabsTrigger>

                  <TabsTrigger className={terminalAsideTabTriggerClassName} value="arena">
                    <span className="size-1.5 shrink-0 rounded-full bg-muted group-data-[state=active]:bg-secondary" />
                    <span className="min-w-0 flex-1 truncate">Arena</span>
                    <span
                      aria-disabled={isLoadingPools}
                      aria-label="Refresh arena pools"
                      className={terminalAsideTabRefreshClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isLoadingPools) {
                          return;
                        }
                        void loadPools();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (isLoadingPools) {
                          return;
                        }
                        void loadPools();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <RefreshCw className={cn("size-3.5", isLoadingPools && "animate-spin")} />
                    </span>
                  </TabsTrigger>

                  <TabsTrigger className={terminalAsideTabTriggerClassName} value="queue">
                    <span className="size-1.5 shrink-0 rounded-full bg-muted group-data-[state=active]:bg-secondary" />
                    <span className="min-w-0 flex-1 truncate">Queue</span>
                    <span
                      aria-disabled={isLoadingQueue || leavingEntryId !== null}
                      aria-label="Refresh queue"
                      className={terminalAsideTabRefreshClassName}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isLoadingQueue || leavingEntryId !== null) {
                          return;
                        }
                        void loadQueue();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (isLoadingQueue || leavingEntryId !== null) {
                          return;
                        }
                        void loadQueue();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <RefreshCw className={cn("size-3.5", isLoadingQueue && "animate-spin")} />
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </aside>

            <div className="space-y-6 lg:order-1">
              <TabsContent className="space-y-6" value="my-fighters">
                <MyFightersTab />
              </TabsContent>

              <TabsContent className="space-y-6" value="my-battlefields">
                <MyBattlefieldsTab />
              </TabsContent>

              <TabsContent className="space-y-6" value="arena">
                <ArenaPoolsTab />
              </TabsContent>

              <TabsContent className="space-y-6" value="queue">
                <ArenaQueueTab />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </>
  );
};

const MyFightersPageWithArena = () => {
  const { fighters, load: loadFighters } = useMyFightersContext();

  return (
    <ArenaPoolsContextController fighters={fighters} onFightersRefresh={loadFighters}>
      <MyFightersPageInner />
    </ArenaPoolsContextController>
  );
};

export const MyFightersPage = () => {
  return (
    <MyFightersContextController>
      <MyBattlefieldsContextController>
        <MyFightersPageWithArena />
      </MyBattlefieldsContextController>
    </MyFightersContextController>
  );
};
