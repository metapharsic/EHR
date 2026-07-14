import { useEffect, useRef, useCallback } from 'react';

export type WSEvent = {
  type: string;
  [key: string]: any;
};

interface UseWebSocketOptions {
  onMessage: (event: WSEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
}

const getWsUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `ws://${window.location.hostname}:5000/ws`;
  }
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
};

const WS_URL = getWsUrl();
const TERMINAL_CLOSE_CODES = new Set([4001]); // auth failure — don't reconnect

export const useWebSocket = ({ onMessage, onConnect, onDisconnect, reconnectDelay = 3000 }: UseWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token || !mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data);
        if (event.type === 'connected') { onConnect?.(); return; }
        onMessage(event);
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = (e) => {
      onDisconnect?.();
      if (!mountedRef.current || TERMINAL_CLOSE_CODES.has(e.code)) return;
      reconnectTimer.current = setTimeout(connect, reconnectDelay);
    };

    ws.onerror = () => ws.close();
  }, [onMessage, onConnect, onDisconnect, reconnectDelay]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event: WSEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send };
};
