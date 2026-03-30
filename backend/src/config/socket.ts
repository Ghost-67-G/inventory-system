import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './index';

let ioInstance: SocketIOServer | null = null;

export const createSocketServer = (httpServer: HttpServer): SocketIOServer => {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: config.SOCKET_CORS_ORIGIN,
      credentials: true
    }
  });

  return ioInstance;
};

export const getIO = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized yet');
  }

  return ioInstance;
};
