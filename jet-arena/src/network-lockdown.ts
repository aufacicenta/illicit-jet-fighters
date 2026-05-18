export const registerServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/broadcast/" });
    await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
  }
};

const postNetworkState = (type: "GAME_START" | "GAME_END"): void => {
  if (!("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({ type });
};

export const enableNetworkLockdown = (): void => {
  postNetworkState("GAME_START");
};

export const disableNetworkLockdown = (): void => {
  postNetworkState("GAME_END");
};

export const lockdownWorkerNetwork = (scope: typeof globalThis): void => {
  const denied = () => {
    throw new Error("Network access is blocked during matches.");
  };

  Object.defineProperty(scope, "fetch", { value: denied, configurable: false, writable: false });
  Object.defineProperty(scope, "WebSocket", {
    value: class {
      constructor() {
        denied();
      }
    },
    configurable: false,
    writable: false,
  });
  Object.defineProperty(scope, "XMLHttpRequest", {
    value: class {
      open() {
        denied();
      }
    },
    configurable: false,
    writable: false,
  });
  Object.defineProperty(scope, "importScripts", {
    value: denied,
    configurable: false,
    writable: false,
  });
};
