/**
 * Migration script to update existing vehicles
 * Renames 'model' field to 'vehicleModel' for existing documents
 * Run with: npx ts-node src/scripts/migrateVehicleModel.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrateVehicles = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-rental';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get the vehicles collection directly
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const vehiclesCollection = db.collection('vehicles');

    // Find all vehicles that have 'model' but not 'vehicleModel'
    const vehiclesWithOldField = await vehiclesCollection.find({
      model: { $exists: true },
      vehicleModel: { $exists: false }
    }).toArray();

    console.log(`📊 Found ${vehiclesWithOldField.length} vehicles to migrate`);

    if (vehiclesWithOldField.length === 0) {
      console.log('✨ No vehicles need migration. All good!');
      process.exit(0);
    }

    // Update each vehicle
    let updated = 0;
    for (const vehicle of vehiclesWithOldField) {
      await vehiclesCollection.updateOne(
        { _id: vehicle._id },
        {
          $set: { vehicleModel: vehicle.model },
          $unset: { model: '' }
        }
      );
      updated++;
      console.log(`✅ Updated: ${vehicle.name} (${vehicle.brand} ${vehicle.model})`);
    }

    console.log(`\n✨ Migration completed successfully!`);
    console.log(`   - Updated ${updated} vehicles`);
    console.log(`   - Changed 'model' field to 'vehicleModel'`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
};

// Run the migration
migrateVehicles();
