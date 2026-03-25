import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './index';

export const createSocketServer = (httpServer: HttpServer): SocketIOServer => {
  return new SocketIOServer(httpServer, {
    cors: {
      origin: config.SOCKET_CORS_ORIGIN,
      credentials: true
    }
  });
};
