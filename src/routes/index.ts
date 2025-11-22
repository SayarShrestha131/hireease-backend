import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * Health check endpoint
 * Returns server status and database connection state
 * GET /health
 */
router.get('/health', (req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  
  // Mongoose connection states:
  // 0 = disconnected
  // 1 = connected
  // 2 = connecting
  // 3 = disconnecting
  
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbState] || 'unknown';

  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: true,
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'not connected'
    }
  });
});

export default router;
