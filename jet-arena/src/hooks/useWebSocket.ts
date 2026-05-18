import { useCallback, useEffect, useRef, useState } from "react";

export type WebSocketConnectionStatus = "connecting" | "open" | "closed";

type UseWebSocketOptions<TMessage> = {
  onMessage: (message: TMessage) => void;
  onOpen?: () => void;
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

      for (const payload of pendingRef.current) {
        socket.send(JSON.stringify(payload));
      }

      pendingRef.current = [];
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) {
          return;
        }

        setConnectionStatus("open");
        flushPending();
        onOpenRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data) as TMessage);
        } catch {
          // Ignore malformed payloads to keep connection healthy.
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }

        setConnectionStatus("closed");
        reconnectTimeout = window.setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      socketRef.current?.close();
      socketRef.current = null;
      pendingRef.current = [];
    };
  }, [url]);

  const send = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }

    pendingRef.current.push(payload);
    return false;
  }, []);

  return {
    send,
    connectionStatus,
    isConnected: connectionStatus === "open",
  };
};
