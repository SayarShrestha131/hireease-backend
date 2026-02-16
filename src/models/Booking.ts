import mongoose, { Document, Schema } from 'mongoose';

/**
 * Booking Status Types
 */
export type BookingStatus = 
  | 'pending'      // Payment pending
  | 'confirmed'    // Payment successful, booking confirmed
  | 'active'       // Vehicle picked up, rental in progress
  | 'completed'    // Vehicle returned, rental completed
  | 'cancelled';   // Booking cancelled

/**
 * Payment Status Types
 */
export type PaymentStatus = 
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

/**
 * Add-ons Interface
 */
export interface IAddOns {
  helmet?: boolean;
  gps?: boolean;
  insurance?: boolean;
}

/**
 * Price Breakdown Interface
 */
export interface IPriceBreakdown {
  basePrice: number;
  duration: number; // in days
  durationDiscount: number;
  addOnsTotal: number;
  tax: number;
  serviceFee: number;
  totalPrice: number;
}

/**
 * IBooking Interface
 */
export interface IBooking extends Document {
  // User and Vehicle
  userId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  
  // Booking Details
  bookingId: string; // Unique booking reference
  status: BookingStatus;
  
  // Rental Period
  pickupDate: Date;
  dropoffDate: Date;
  pickupTime: string; // HH:MM format
  dropoffTime: string; // HH:MM format
  
  // Add-ons
  addOns: IAddOns;
  
  // Pricing
  priceBreakdown: IPriceBreakdown;
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentMethod?: string; // 'eSewa', 'Khalti', 'Card', 'Direct'
  paymentId?: string; // Payment gateway transaction ID
  paidAt?: Date;
  
  // Pickup/Return
  pickedUpAt?: Date;
  returnedAt?: Date;
  
  // Review
  rating?: number;
  review?: string;
  reviewedAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking Schema
 */
const bookingSchema = new Schema<IBooking>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    bookingId: {
      type: String,
      required: false, // Auto-generated in pre-save hook
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    dropoffDate: {
      type: Date,
      required: true,
    },
    pickupTime: {
      type: String,
      required: true,
    },
    dropoffTime: {
      type: String,
      required: true,
    },
    addOns: {
      helmet: { type: Boolean, default: false },
      gps: { type: Boolean, default: false },
      insurance: { type: Boolean, default: false },
    },
    priceBreakdown: {
      basePrice: { type: Number, required: true },
      duration: { type: Number, required: true },
      durationDiscount: { type: Number, default: 0 },
      addOnsTotal: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      totalPrice: { type: Number, required: true },
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      required: true,
    },
    paymentMethod: {
      type: String,
      required: false,
    },
    paymentId: {
      type: String,
      required: false,
    },
    paidAt: {
      type: Date,
      required: false,
    },
    pickedUpAt: {
      type: Date,
      required: false,
    },
    returnedAt: {
      type: Date,
      required: false,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: false,
    },
    review: {
      type: String,
      required: false,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ vehicleId: 1, status: 1 });
bookingSchema.index({ pickupDate: 1, dropoffDate: 1 });

/**
 * Generate unique booking ID
 */
bookingSchema.pre('save', async function (next) {
  if (!this.bookingId) {
    // Generate booking ID: BK-YYYYMMDD-XXXX
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.bookingId = `BK-${dateStr}-${random}`;
  }
  next();
});

const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
