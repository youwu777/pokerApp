import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { roomManager } from './utils/roomManager.js';
import { setupSocketHandlers } from './socket/handlers.js';

const app = express();
const httpServer = createServer(app);

// Trust proxy - required for rate limiting behind reverse proxy/load balancer
app.set('trust proxy', 1);

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://honest-poker.win",
  "https://www.honest-poker.win",
  process.env.ALLOWED_ORIGIN // Allow custom origin via environment variable
].filter(Boolean); // Remove undefined values

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Rate limiters
const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 room creations per windowMs
  message: 'Too many rooms created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 API requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// REST API endpoints
app.post('/api/rooms', createRoomLimiter, (req, res) => {
  const { settings } = req.body;
  const roomId = uuidv4().substring(0, 8); // Short room ID

  const room = roomManager.createRoom(roomId, settings);

  res.json({
    roomId,
    url: `${req.protocol}://${req.get('host')}/room/${roomId}`
  });
});

app.get('/api/rooms/:roomId', apiLimiter, (req, res) => {
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
