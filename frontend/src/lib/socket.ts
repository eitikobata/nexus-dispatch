import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Single shared socket for the whole app — components subscribe/unsubscribe
// to events on it rather than each opening their own connection.
export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    socket = io(url, { transports: ['websocket'], autoConnect: true });
  }
  return socket;
}
