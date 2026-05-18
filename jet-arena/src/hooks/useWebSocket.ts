import { useEffect, useRef } from "react";

export const useWebSocket = <TMessage>(url: string, onMessage: (message: TMessage) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimeout: number | null = null;

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

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
    };
  }, [url]);

  const send = (payload: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  };

  return { send };
};
