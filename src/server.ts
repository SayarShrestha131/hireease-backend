import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

/**
 * Initialize Express application
 */
const app: Application = express();

/**
 * Middleware Configuration
 */

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      // Always allow same-host dev origins for admin.html and local tools
      const devSameOriginAllowlist = new Set([
        `http://localhost:${config.port}`,
        `http://127.0.0.1:${config.port}`,
      ]);
      if (devSameOriginAllowlist.has(origin)) {
        callback(null, true);
        return;
      }

      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Parse incoming JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Serve uploaded files from uploads directory
app.use('/uploads', express.static('uploads'));

// Detailed request/response logging middleware
app.use(requestLogger);

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
