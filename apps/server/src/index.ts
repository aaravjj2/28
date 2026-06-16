import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socketHandlers";
import { RoomManager } from "./roomManager";
import { TurnTimerManager } from "./timers";

const PORT = Number(process.env.PORT ?? 3001);

export function createApp() {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });
  const roomManager = new RoomManager();
  const timerManager = new TurnTimerManager();
  registerSocketHandlers(io, roomManager, timerManager);

  return { httpServer, io, roomManager, timerManager };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { httpServer } = createApp();
  httpServer.listen(PORT, () => {
    console.log(`28 game server listening on port ${PORT}`);
  });
}
