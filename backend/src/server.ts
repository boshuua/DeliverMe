import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { pool } from './config/database.js';
import { initializeSockets } from './sockets/index.js';
import { manualIpBlockMiddleware, refreshBlockedIpCache } from './middleware/manualIpBlock.js';
import { auditMiddleware } from './middleware/auditLogger.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import driverRoutes from './routes/driverRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
initializeSockets(server);

// Security & Parsing Middlewares
app.use(
  cors({
    origin: [config.corsOrigin, 'http://localhost:4200'],
    credentials: true,
  })
);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Apply IP Blocklist enforcement FIRST on all incoming HTTP requests
app.use(manualIpBlockMiddleware);

// Apply Audit Logging middleware to intercept 401/403 access attempts
app.use(auditMiddleware);

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const dbTest = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status: 'healthy',
      database: 'connected',
      dbTimestamp: dbTest.rows[0].current_time,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// REST API Endpoints v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/driver', driverRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ServerError]', err);
  if (err.message && err.message.includes('Invalid file type')) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server & prime cache
if (process.env.NODE_ENV !== 'test') {
  refreshBlockedIpCache()
    .then(() => {
      server.listen(config.port, () => {
        console.log(`[Server] Delivery Management Backend running on port ${config.port}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`[Server] Admin Alerts WebSocket stream ready on /admin-alerts`);
      });
    })
    .catch((err) => {
      console.error('[Server] Failed to initialize server:', err);
      process.exit(1);
    });
}

export { app, server };
