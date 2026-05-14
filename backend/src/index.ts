import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import routes from './routes';
import { setupSocketIO } from './services/socket.service';

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Dubyx API', version: '1.0.0', timestamp: new Date() });
});

// Setup Socket.IO for GPS tracking
setupSocketIO(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Dubyx API running on port ${PORT}`);
  console.log(`📡 Socket.IO GPS tracking active`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

export default app;
