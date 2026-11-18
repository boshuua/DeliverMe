import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthUserPayload } from '../types/index.js';

let io: SocketIOServer | null = null;
let adminNamespace: Namespace | null = null;

export function initializeSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.corsOrigin, 'http://localhost:4200'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  adminNamespace = io.of('/admin-alerts');

  // Middleware: Authenticate Admin token during WebSocket handshake
  adminNamespace.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers['authorization']?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
      if (decoded.role !== 'ADMIN') {
        return next(new Error('Authorization error: Admin role required for alerts stream'));
      }

      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  adminNamespace.on('connection', (socket: Socket) => {
    const user = (socket as any).user as AuthUserPayload;
    console.log(`[WebSocket] Admin connected to /admin-alerts: ${user?.email} (${socket.id})`);

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Admin disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function notifyDeliveryCreated(payload: {
  deliveryId: string;
  trackingNumber: string;
  createdBy: string;
}): void {
  if (adminNamespace) {
    adminNamespace.emit('delivery:created', payload);
  }
}

export function notifyDeliveryCompleted(payload: {
  deliveryId: string;
  trackingNumber: string;
  driverId: string;
  completedAt: string;
  location: { latitude: number; longitude: number };
}): void {
  if (adminNamespace) {
    adminNamespace.emit('delivery:completed', payload);
  }
}

export function notifySecurityUnauthenticatedAttempt(payload: {
  ipAddress: string;
  endpoint: string;
  timestamp: string;
}): void {
  if (adminNamespace) {
    adminNamespace.emit('security:unauthenticated_attempt', payload);
  }
}

export function notifySecurityIpBlocked(payload: {
  ipAddress: string;
  blockedBy: string;
  reason?: string | null;
}): void {
  if (adminNamespace) {
    adminNamespace.emit('security:ip_blocked', payload);
  }
}
