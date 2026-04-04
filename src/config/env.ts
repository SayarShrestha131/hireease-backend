import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env regardless of cwd
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

// Validate required environment variables
const requiredEnvVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
