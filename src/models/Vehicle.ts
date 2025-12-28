import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicle extends Document {
  name: string;
  brand: string;
  model: string;
  year: number;
  type: 'sedan' | 'suv' | 'hatchback' | 'truck' | 'van' | 'sports' | 'electric';
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  transmission: 'manual' | 'automatic';
  seats: number;
  pricePerDay: number;
  images: string[];
  features: string[];
  specifications: {
    engine?: string;
    power?: string;
    mileage?: string;
    color?: string;
  };
  availability: {
    isAvailable: boolean;
    location: string;
  };
  rating: number;
  totalReviews: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['sedan', 'suv', 'hatchback', 'truck', 'van', 'sports', 'electric'],
      required: true,
    },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
      required: true,
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic'],
      required: true,
    },
    seats: {
      type: Number,
      required: true,
    },
    pricePerDay: {
      type: Number,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    specifications: {
      engine: String,
      power: String,
      mileage: String,
      color: String,
    },
    availability: {
      isAvailable: {
        type: Boolean,
        default: true,
      },
      location: {
        type: String,
        required: true,
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search and filtering
vehicleSchema.index({ name: 'text', brand: 'text', model: 'text', description: 'text' });
vehicleSchema.index({ type: 1, fuelType: 1, transmission: 1 });
vehicleSchema.index({ pricePerDay: 1 });
vehicleSchema.index({ 'availability.isAvailable': 1 });

const Vehicle = mongoose.model<IVehicle>('Vehicle', vehicleSchema);

export default Vehicle;
