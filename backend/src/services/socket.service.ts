import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export const setupSocketIO = (io: Server) => {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; name: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`📍 GPS connected: ${user.name} (${user.role})`);

    // Join room based on role
    if (user.role === 'SALESMAN') {
      socket.join(`salesman:${user.id}`);
      socket.join('salesmen');
    } else {
      socket.join('admins');
    }

    // Salesman sends location updates
    socket.on('location:update', async (data: LocationUpdate) => {
      if (user.role !== 'SALESMAN') return;

      try {
        const log = await prisma.gpsLog.create({
          data: {
            userId: user.id,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
          },
        });

        // Broadcast to admins
        io.to('admins').emit('location:updated', {
          ...log,
          userId: user.id,
          name: user.name,
        });
      } catch (err) {
        console.error('GPS log error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`📍 GPS disconnected: ${user.name}`);
      if (user.role === 'SALESMAN') {
        io.to('admins').emit('salesman:offline', { userId: user.id, name: user.name });
      }
    });
  });
};
