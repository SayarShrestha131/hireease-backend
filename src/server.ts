import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

/**
 * Initialize Express application
 */
const app: Application = express();

/**
 * Middleware Configuration
 */

// Enable CORS for all origins in development
app.use(cors({
  origin: '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse incoming JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Register API Routes
 */
app.use('/api', routes);

/**
 * Register Error Handling Middleware (must be last)
 */
app.use(errorHandler);

/**
 * Server Initialization
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB Atlas
    await connectDatabase();

    // Start HTTP server - bind to 0.0.0.0 to allow external connections
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`✓ Environment: ${config.nodeEnv}`);
      console.log(`✓ Server accessible at http://0.0.0.0:${config.port}`);
      console.log(`✓ Server ready to accept requests`);
    });

    /**
     * Graceful Shutdown Handling
     */
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('✓ HTTP server closed');
        
        // Close database connection
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error) => {
      console.error('Unhandled Promise Rejection:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
