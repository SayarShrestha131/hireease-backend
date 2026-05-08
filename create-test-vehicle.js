/**
 * Create a test vehicle for payment testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Vehicle schema (simplified)
const vehicleSchema = new mongoose.Schema({
  name: String,
  brand: String,
  model: String,
  year: Number,
  type: String,
  pricePerDay: Number,
  pricePerWeek: Number,
  pricePerMonth: Number,
  availability: { type: Boolean, default: true },
  status: { type: String, default: 'available' },
  features: [String],
  images: [String],
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

async function createTestVehicle() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if test vehicle already exists
    const existingVehicle = await Vehicle.findOne({ name: 'Test Vehicle' });
    
    if (existingVehicle) {
      console.log('✓ Test vehicle already exists');
      console.log(`  Name: ${existingVehicle.name}`);
      console.log(`  ID: ${existingVehicle._id}`);
      console.log(`  Price: ${existingVehicle.pricePerDay} NPR/day`);
      await mongoose.connection.close();
      return;
    }

    // Create test vehicle
    const testVehicle = new Vehicle({
      name: 'Test Vehicle',
      brand: 'Test Brand',
      model: 'Test Model',
      year: 2024,
      type: 'bike',
      pricePerDay: 1000,
      pricePerWeek: 6000,
      pricePerMonth: 20000,
      availability: true,
      status: 'available',
      features: ['Helmet', 'GPS', 'Insurance'],
      images: ['test-vehicle.jpg'],
      description: 'Test vehicle for payment integration testing'
    });

    await testVehicle.save();

    console.log('✓ Test vehicle created successfully');
    console.log(`  Name: ${testVehicle.name}`);
    console.log(`  ID: ${testVehicle._id}`);
    console.log(`  Price: ${testVehicle.pricePerDay} NPR/day`);

    await mongoose.connection.close();
    console.log('✓ Done');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createTestVehicle();
