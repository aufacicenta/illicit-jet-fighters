import { useCallback, useEffect, useRef, useState } from "react";

export type WebSocketConnectionStatus = "connecting" | "open" | "closed";

type UseWebSocketOptions<TMessage> = {
  onMessage: (message: TMessage) => void;
  onOpen?: () => void;
};

const WS_LOGGING_ENABLED = import.meta.env.VITE_WS_LOG !== "false";

const LOG_PREFIX = "[WS]";
const LOG_STYLES = {
  send: "color: #4CAF50; font-weight: bold",
  receive: "color: #2196F3; font-weight: bold",
  lifecycle: "color: #FF9800; font-weight: bold",
  error: "color: #F44336; font-weight: bold",
} as const;

const wsLog = (category: keyof typeof LOG_STYLES, message: string, data?: unknown) => {
  if (!WS_LOGGING_ENABLED) return;
  const style = LOG_STYLES[category];
  if (data !== undefined) {
    console.log(`%c${LOG_PREFIX} [${category.toUpperCase()}] ${message}`, style, data);
  } else {
    console.log(`%c${LOG_PREFIX} [${category.toUpperCase()}] ${message}`, style);
  }
};

const summarizePayload = (payload: unknown): string => {
  if (typeof payload !== "object" || payload === null) {
    return String(payload);
  }

  const obj = payload as Record<string, unknown>;
  const type = obj.type as string | undefined;
  if (!type) {
    return JSON.stringify(payload).slice(0, 120);
  }

  switch (type) {
    case "section:start":
      return `${type} → ${obj.sectionId}`;
    case "section:delta":
      return `${type} → ${obj.sectionId} (+${(obj.delta as string)?.length ?? 0})`;
    case "section:complete":
      return `${type} → ${obj.sectionId}`;
    case "section:error":
      return `${type} → ${obj.sectionId}: ${obj.error}`;
    case "pipeline:sync":
      return `${type} (outputs: ${Object.keys((obj.outputs as object) ?? {}).join(", ") || "none"})`;
    case "pipeline:gate":
      return `${type} → ${obj.sectionId}: "${obj.message}"`;
    case "pipeline:complete":
      return type;
    case "refine":
      return `${type} → ${obj.sectionId} (msg length: ${(obj.message as string)?.length ?? 0})`;
    case "edit":
      return `${type} → ${obj.sectionId} (content length: ${(obj.content as string)?.length ?? 0})`;
    case "pipeline:continue":
      return type;
    default:
      return `${type} ${JSON.stringify(payload).slice(0, 80)}`;
  }
};

export const useWebSocket = <TMessage>(
  url: string | null,
  { onMessage, onOpen }: UseWebSocketOptions<TMessage>,
) => {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<unknown[]>([]);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>("connecting");

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!url) {
      wsLog("lifecycle", "URL is null, closing connection");
      setConnectionStatus("closed");
      socketRef.current?.close();
      socketRef.current = null;
      pendingRef.current = [];
      return;
    }

    let cancelled = false;
    let reconnectTimeout: number | null = null;

    const flushPending = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (pendingRef.current.length > 0) {
        wsLog("send", `Flushing ${pendingRef.current.length} pending message(s)`);
      }

      for (const payload of pendingRef.current) {
        wsLog("send", `FLUSH → ${summarizePayload(payload)}`, payload);
        socket.send(JSON.stringify(payload));
      }

      pendingRef.current = [];
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      wsLog("lifecycle", `Connecting to ${url}`);
      setConnectionStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          return;
        }

        wsLog("lifecycle", `Connected to ${url}`);
        setConnectionStatus("open");
        flushPending();
        onOpenRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as TMessage;
          wsLog("receive", `← ${summarizePayload(parsed)}`, parsed);
          onMessageRef.current(parsed);
        } catch (err) {
          wsLog("error", "Failed to parse incoming message", {
            raw: String(event.data).slice(0, 200),
            error: err,
          });
        }
      };

      socket.onclose = (event) => {
        if (cancelled) {
          return;
        }

        wsLog(
          "lifecycle",
          `Disconnected (code: ${event.code}, reason: "${event.reason || "none"}")`,
        );
        setConnectionStatus("closed");
        reconnectTimeout = window.setTimeout(() => {
          wsLog("lifecycle", "Attempting reconnect...");
          connect();
        }, 1000);
      };

      socket.onerror = (event) => {
        wsLog("error", "WebSocket error", event);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      wsLog("lifecycle", "Cleanup — closing socket");
      socketRef.current?.close();
      socketRef.current = null;
      pendingRef.current = [];
    };
  }, [url]);

  const send = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      wsLog("send", `→ ${summarizePayload(payload)}`, payload);
      socket.send(JSON.stringify(payload));
      return true;
    }

    wsLog("send", `QUEUED (socket not open) → ${summarizePayload(payload)}`, payload);
    pendingRef.current.push(payload);
    return false;
  }, []);

  return {
    send,
    connectionStatus,
    isConnected: connectionStatus === "open",
  };
};
