import { io, type Socket } from "socket.io-client";
import { SERVER_URL } from "../constants";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL || undefined, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitWithAck<T>(
  event: string,
  payload: unknown = {}
): Promise<T> {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }

  return new Promise((resolve, reject) => {
    client.emit(event, payload, (response: T & { ok?: boolean; error?: string }) => {
      if (response && typeof response === "object" && "ok" in response && response.ok === false) {
        reject(new Error(response.error ?? `${event} failed`));
        return;
      }
      resolve(response);
    });
  });
}
