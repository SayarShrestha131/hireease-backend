import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes';
import passwordRoutes from './passwordRoutes';
import profileRoutes from './profileRoutes';
import vehicleRoutes from './vehicleRoutes';
import kycRoutes from './kycRoutes';
import bookingRoutes from './bookingRoutes';
import faceVerificationRoutes from './faceVerificationRoutes';
import faceRecognitionRoutes from './faceRecognitionRoutes';
import registeredPersonRoutes from './registeredPersonRoutes';
import identityVerificationRoutes from './identityVerificationRoutes';

const router = Router();

/**
 * Mount auth routes at /auth
 * Accessible at /api/auth/*
 */
router.use('/auth', authRoutes);

/**
 * Mount password routes at /auth
 * Accessible at /api/auth/*
 */
router.use('/auth', passwordRoutes);

/**
 * Mount profile routes at /profile
 * Accessible at /api/profile/*
 */
router.use('/profile', profileRoutes);

/**
 * Mount vehicle routes at /vehicles
 * Accessible at /api/vehicles/*
 */
router.use('/vehicles', vehicleRoutes);

/**
 * Mount KYC routes at /kyc
 * Accessible at /api/kyc/*
 */
router.use('/kyc', kycRoutes);

/**
 * Mount booking routes at /bookings
 * Accessible at /api/bookings/*
 */
router.use('/bookings', bookingRoutes);

/**
 * Mount face verification routes at /face-verification
 * Accessible at /api/face-verification/*
 */
router.use('/face-verification', faceVerificationRoutes);

/**
 * Mount face recognition routes at /face-recognition
 * Accessible at /api/face-recognition/*
 */
router.use('/face-recognition', faceRecognitionRoutes);

/**
 * Mount registered persons routes at /registered-persons
 * Accessible at /api/registered-persons/*
 */
router.use('/registered-persons', registeredPersonRoutes);

/**
 * Mount identity verification routes at /identity
 * Accessible at /api/identity/*
 */
router.use('/identity', identityVerificationRoutes);

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
  
  const dbStatusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const dbStatus = dbStatusMap[dbState] || 'unknown';

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
