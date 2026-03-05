/**
 * Seed script to populate database with sample vehicles
 * Run with: npx ts-node src/scripts/seedVehicles.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Vehicle from '../models/Vehicle';

dotenv.config();

const sampleVehicles = [
  {
    name: 'Toyota Corolla 2023',
    brand: 'Toyota',
    vehicleModel: 'Corolla',
    year: 2023,
    type: 'sedan',
    fuelType: 'petrol',
    transmission: 'automatic',
    seats: 5,
    pricePerDay: 5000,
    images: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800',
    ],
    features: ['Air Conditioning', 'Bluetooth', 'Backup Camera', 'USB Charging'],
    specifications: {
      engine: '1.8L 4-Cylinder',
      power: '139 HP',
      mileage: '15 km/l',
      color: 'Silver',
    },
    availability: {
      isAvailable: true,
      location: 'Karachi',
    },
    rating: 4.5,
    totalReviews: 28,
    description: 'Reliable and fuel-efficient sedan perfect for city driving and long trips.',
  },
  {
    name: 'Honda Civic 2024',
    brand: 'Honda',
    vehicleModel: 'Civic',
    year: 2024,
    type: 'sedan',
    fuelType: 'petrol',
    transmission: 'automatic',
    seats: 5,
    pricePerDay: 6500,
    images: [
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800',
      'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800',
    ],
    features: ['Sunroof', 'Leather Seats', 'Navigation', 'Cruise Control'],
    specifications: {
      engine: '2.0L Turbo',
      power: '180 HP',
      mileage: '14 km/l',
      color: 'Black',
    },
    availability: {
      isAvailable: true,
      location: 'Lahore',
    },
    rating: 4.7,
    totalReviews: 42,
    description: 'Sporty and stylish sedan with advanced features and excellent performance.',
  },
  {
    name: 'Toyota Fortuner 2023',
    brand: 'Toyota',
    vehicleModel: 'Fortuner',
    year: 2023,
    type: 'suv',
    fuelType: 'diesel',
    transmission: 'automatic',
    seats: 7,
    pricePerDay: 12000,
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800',
    ],
    features: ['4WD', 'Third Row Seating', 'Premium Sound', 'Parking Sensors'],
    specifications: {
      engine: '2.8L Diesel',
      power: '204 HP',
      mileage: '12 km/l',
      color: 'White',
    },
    availability: {
      isAvailable: true,
      location: 'Islamabad',
    },
    rating: 4.8,
    totalReviews: 35,
    description: 'Powerful SUV perfect for family trips and off-road adventures.',
  },
  {
    name: 'Suzuki Swift 2023',
    brand: 'Suzuki',
    vehicleModel: 'Swift',
    year: 2023,
    type: 'hatchback',
    fuelType: 'petrol',
    transmission: 'manual',
    seats: 5,
    pricePerDay: 3500,
    images: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800',
    ],
    features: ['Fuel Efficient', 'Compact Design', 'Easy Parking', 'Bluetooth'],
    specifications: {
      engine: '1.2L 4-Cylinder',
      power: '83 HP',
      mileage: '18 km/l',
      color: 'Red',
    },
    availability: {
      isAvailable: true,
      location: 'Karachi',
    },
    rating: 4.3,
    totalReviews: 19,
    description: 'Compact and economical hatchback ideal for city commuting.',
  },
  {
    name: 'Honda BR-V 2024',
    brand: 'Honda',
    vehicleModel: 'BR-V',
    year: 2024,
    type: 'suv',
    fuelType: 'petrol',
    transmission: 'automatic',
    seats: 7,
    pricePerDay: 8500,
    images: [
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800',
      'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800',
    ],
    features: ['7 Seater', 'Touchscreen Display', 'Rear AC Vents', 'Alloy Wheels'],
    specifications: {
      engine: '1.5L i-VTEC',
      power: '120 HP',
      mileage: '13 km/l',
      color: 'Gray',
    },
    availability: {
      isAvailable: true,
      location: 'Lahore',
    },
    rating: 4.6,
    totalReviews: 31,
    description: 'Spacious family SUV with modern features and comfortable seating.',
  },
  {
    name: 'Tesla Model 3 2024',
    brand: 'Tesla',
    vehicleModel: 'Model 3',
    year: 2024,
    type: 'electric',
    fuelType: 'electric',
    transmission: 'automatic',
    seats: 5,
    pricePerDay: 15000,
    images: [
      'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800',
      'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800',
    ],
    features: ['Autopilot', 'Premium Interior', 'Long Range', 'Fast Charging'],
    specifications: {
      engine: 'Electric Motor',
      power: '283 HP',
      mileage: '500 km range',
      color: 'Blue',
    },
    availability: {
      isAvailable: true,
      location: 'Islamabad',
    },
    rating: 4.9,
    totalReviews: 15,
    description: 'Cutting-edge electric vehicle with advanced technology and zero emissions.',
  },
  {
    name: 'Toyota Hilux 2023',
    brand: 'Toyota',
    vehicleModel: 'Hilux',
    year: 2023,
    type: 'truck',
    fuelType: 'diesel',
    transmission: 'manual',
    seats: 5,
    pricePerDay: 10000,
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800',
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800',
    ],
    features: ['4x4', 'Heavy Duty', 'Cargo Bed', 'Towing Capacity'],
    specifications: {
      engine: '2.8L Diesel',
      power: '204 HP',
      mileage: '11 km/l',
      color: 'White',
    },
    availability: {
      isAvailable: false,
      location: 'Karachi',
    },
    rating: 4.7,
    totalReviews: 22,
    description: 'Rugged and reliable pickup truck for heavy-duty work and adventures.',
  },
  {
    name: 'Hyundai Elantra 2024',
    brand: 'Hyundai',
    vehicleModel: 'Elantra',
    year: 2024,
    type: 'sedan',
    fuelType: 'hybrid',
    transmission: 'automatic',
    seats: 5,
    pricePerDay: 7000,
    images: [
      'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800',
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800',
    ],
    features: ['Hybrid Engine', 'Smart Cruise Control', 'Wireless Charging', 'LED Lights'],
    specifications: {
      engine: '1.6L Hybrid',
      power: '139 HP',
      mileage: '20 km/l',
      color: 'Silver',
    },
    availability: {
      isAvailable: true,
      location: 'Lahore',
    },
    rating: 4.5,
    totalReviews: 18,
    description: 'Eco-friendly hybrid sedan with excellent fuel economy and modern design.',
  },
];

const seedVehicles = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-rental';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing vehicles
    await Vehicle.deleteMany({});
    console.log('🗑️  Cleared existing vehicles');

    // Insert sample vehicles
    const vehicles = await Vehicle.insertMany(sampleVehicles);
    console.log(`✅ Inserted ${vehicles.length} sample vehicles`);

    // Display summary
    console.log('\n📊 Vehicle Summary:');
    console.log(`   - Sedans: ${vehicles.filter(v => v.type === 'sedan').length}`);
    console.log(`   - SUVs: ${vehicles.filter(v => v.type === 'suv').length}`);
    console.log(`   - Hatchbacks: ${vehicles.filter(v => v.type === 'hatchback').length}`);
    console.log(`   - Trucks: ${vehicles.filter(v => v.type === 'truck').length}`);
    console.log(`   - Electric: ${vehicles.filter(v => v.type === 'electric').length}`);
    console.log(`   - Available: ${vehicles.filter(v => v.availability.isAvailable).length}`);

    console.log('\n✨ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding vehicles:', error);
    process.exit(1);
  }
};

// Run the seed function
seedVehicles();
