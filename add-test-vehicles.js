/**
 * Add Test Vehicles Script
 * 
 * This script adds sample vehicles to the database for testing the booking flow
 * Run: node add-test-vehicles.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Vehicle Schema (simplified)
const vehicleSchema = new mongoose.Schema({
  name: String,
  brand: String,
  vehicleModel: String,
  year: Number,
  category: String,
  transmission: String,
  fuelType: String,
  seatingCapacity: Number,
  pricePerDay: Number,
  images: [String],
  features: [String],
  availability: {
    isAvailable: Boolean,
    nextAvailableDate: Date,
  },
  specifications: {
    engineCapacity: String,
    mileage: String,
    color: String,
  },
  location: String,
  description: String,
  rating: Number,
  totalReviews: Number,
  createdAt: Date,
  updatedAt: Date,
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// Test vehicles data
const testVehicles = [
  {
    name: 'Toyota Corolla 2023',
    brand: 'Toyota',
    vehicleModel: 'Corolla',
    year: 2023,
    category: 'Sedan',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    pricePerDay: 3500,
    images: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800',
    ],
    features: [
      'Air Conditioning',
      'Power Steering',
      'ABS',
      'Airbags',
      'Bluetooth',
      'Backup Camera',
    ],
    availability: {
      isAvailable: true,
      nextAvailableDate: new Date(),
    },
    specifications: {
      engineCapacity: '1800cc',
      mileage: '15 km/l',
      color: 'Silver',
    },
    location: 'Kathmandu',
    description: 'Comfortable and reliable sedan perfect for city driving and long trips.',
    rating: 4.5,
    totalReviews: 28,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Honda City 2022',
    brand: 'Honda',
    vehicleModel: 'City',
    year: 2022,
    category: 'Sedan',
    transmission: 'Manual',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    pricePerDay: 3000,
    images: [
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
    ],
    features: [
      'Air Conditioning',
      'Power Steering',
      'ABS',
      'Airbags',
      'Music System',
    ],
    availability: {
      isAvailable: true,
      nextAvailableDate: new Date(),
    },
    specifications: {
      engineCapacity: '1500cc',
      mileage: '17 km/l',
      color: 'White',
    },
    location: 'Kathmandu',
    description: 'Fuel-efficient and spacious sedan ideal for daily commute.',
    rating: 4.3,
    totalReviews: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Hyundai Creta 2023',
    brand: 'Hyundai',
    vehicleModel: 'Creta',
    year: 2023,
    category: 'SUV',
    transmission: 'Automatic',
    fuelType: 'Diesel',
    seatingCapacity: 5,
    pricePerDay: 5000,
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800',
    ],
    features: [
      'Air Conditioning',
      'Power Steering',
      'ABS',
      'Airbags',
      'Sunroof',
      'Leather Seats',
      'Touchscreen',
      'Cruise Control',
    ],
    availability: {
      isAvailable: true,
      nextAvailableDate: new Date(),
    },
    specifications: {
      engineCapacity: '1500cc Turbo',
      mileage: '18 km/l',
      color: 'Black',
    },
    location: 'Kathmandu',
    description: 'Premium SUV with advanced features and comfortable ride.',
    rating: 4.7,
    totalReviews: 42,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Maruti Swift 2023',
    brand: 'Maruti',
    vehicleModel: 'Swift',
    year: 2023,
    category: 'Hatchback',
    transmission: 'Manual',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    pricePerDay: 2500,
    images: [
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
    ],
    features: [
      'Air Conditioning',
      'Power Steering',
      'ABS',
      'Airbags',
      'Music System',
    ],
    availability: {
      isAvailable: true,
      nextAvailableDate: new Date(),
    },
    specifications: {
      engineCapacity: '1200cc',
      mileage: '22 km/l',
      color: 'Red',
    },
    location: 'Kathmandu',
    description: 'Compact and fuel-efficient hatchback perfect for city driving.',
    rating: 4.2,
    totalReviews: 35,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Mahindra Scorpio 2022',
    brand: 'Mahindra',
    vehicleModel: 'Scorpio',
    year: 2022,
    category: 'SUV',
    transmission: 'Manual',
    fuelType: 'Diesel',
    seatingCapacity: 7,
    pricePerDay: 4500,
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800',
    ],
    features: [
      'Air Conditioning',
      'Power Steering',
      'ABS',
      'Airbags',
      '4WD',
      'Hill Assist',
    ],
    availability: {
      isAvailable: true,
      nextAvailableDate: new Date(),
    },
    specifications: {
      engineCapacity: '2200cc',
      mileage: '14 km/l',
      color: 'Brown',
    },
    location: 'Kathmandu',
    description: 'Rugged SUV perfect for off-road adventures and family trips.',
    rating: 4.4,
    totalReviews: 22,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Main function
const addTestVehicles = async () => {
  try {
    await connectDB();

    console.log('\n🚗 Adding test vehicles...\n');

    // Clear existing vehicles (optional - comment out if you want to keep existing)
    // await Vehicle.deleteMany({});
    // console.log('✅ Cleared existing vehicles\n');

    // Add test vehicles
    for (const vehicleData of testVehicles) {
      const vehicle = new Vehicle(vehicleData);
      await vehicle.save();
      console.log(`✅ Added: ${vehicle.name} (${vehicle.category}) - Rs. ${vehicle.pricePerDay}/day`);
    }

    console.log(`\n✅ Successfully added ${testVehicles.length} test vehicles!`);
    console.log('\n📊 Summary:');
    console.log(`   - Sedans: 2`);
    console.log(`   - SUVs: 2`);
    console.log(`   - Hatchbacks: 1`);
    console.log(`\n💡 You can now test the booking flow with these vehicles!`);

  } catch (error) {
    console.error('\n❌ Error adding test vehicles:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
};

// Run the script
addTestVehicles();
