import { useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export const useSocket = () => {
  const token = useAuthStore((s) => s.accessToken);

  const socket = useMemo(() => {
    return io(import.meta.env.VITE_SOCKET_URL, {
      autoConnect: false,
      auth: {
        token
      }
    });
  }, [token]);

  useEffect(() => {
    if (token) {
      socket.connect();
    }
    return () => {
      socket.disconnect();
    };
  }, [socket, token]);

  return socket;
};
