import mongoose from 'mongoose';
import { config } from './env';

/**
 * Establishes connection to MongoDB Atlas database
 * Reads connection URI from environment variables
 * Logs connection status and handles errors
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Connect to MongoDB Atlas using the URI from environment variables
    await mongoose.connect(config.mongoUri);

    console.log('✓ MongoDB Atlas connected successfully');
    console.log(`✓ Database: ${mongoose.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected successfully');
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    
    // Exit process with failure code if connection fails
    process.exit(1);
  }
};
