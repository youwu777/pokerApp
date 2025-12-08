import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './utils/roomManager.js';
import { setupSocketHandlers } from './socket/handlers.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite default port
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// REST API endpoints
app.post('/api/rooms', (req, res) => {
  const { settings } = req.body;
  const roomId = uuidv4().substring(0, 8); // Short room ID
  
  const room = roomManager.createRoom(roomId, settings);
  
  res.json({
    roomId,
    url: `${req.protocol}://${req.get('host')}/room/${roomId}`
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    roomId: room.id,
    playerCount: room.players.length,
    settings: room.settings
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  setupSocketHandlers(io, socket);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🃏 Poker server running on port ${PORT}`);
});
